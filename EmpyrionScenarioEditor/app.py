#!/usr/bin/env python3
"""
Empyrion Scenario Editor - Main Flask Application

A web-based tool for editing and managing Empyrion Galactic Survival scenarios.
Features scenario loading, configuration editing, and galaxy design tools.
"""

from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import json
from pathlib import Path
from functools import wraps

# Import core modules
from scenario_loader import ScenarioLoader

# Import security and error handling
from utils.security import PathValidator, InputSanitizer
from utils.exceptions import (
    EmpyrionEditorError, ValidationError, ScenarioNotFoundError,
    create_error_response, require_params
)
from utils.logging_config import init_logging, get_logger, log_context, logged_function

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Initialize logging system
logger = init_logging(
    log_level='INFO',
    log_directory='logs',
    enable_console=True,
    enable_file=True
)

# Initialize security validator - restrict to user's home directory for safety
user_home = os.path.expanduser('~')
path_validator = PathValidator(
    allowed_root=user_home,  # Restrict to user's home directory
    max_file_size=50 * 1024 * 1024,  # 50MB limit
    max_depth=20  # Reasonable directory depth
)

# Initialize scenario loader
scenario_loader = ScenarioLoader()


def handle_api_errors(operation_name: str = "API operation"):
    """
    Decorator to provide consistent error handling for API endpoints.
    
    Args:
        operation_name: Description of the operation for logging
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                with log_context(
                    endpoint=f.__name__,
                    operation=operation_name,
                    remote_addr=request.remote_addr,
                    user_agent=request.headers.get('User-Agent', 'Unknown')[:100]
                ):
                    return f(*args, **kwargs)
            except EmpyrionEditorError as e:
                logger.error(f"Application error in {operation_name}", {
                    'error_type': e.__class__.__name__,
                    'message': str(e),
                    'context': getattr(e, 'context', {})
                })
                error_dict, status_code = create_error_response(e)
                return jsonify(error_dict), status_code
            except Exception as e:
                logger.error(f"Unexpected error in {operation_name}", {
                    'error_type': e.__class__.__name__,
                    'message': str(e)
                }, exc_info=True)
                error_dict, status_code = create_error_response(e)
                return jsonify(error_dict), status_code
        return decorated_function
    return decorator

@app.route('/')
def index():
    """Main page - File browser and scenario selector"""
    return render_template('index.html')

@app.route('/api/browse')
@handle_api_errors("Directory browsing")
def browse_directory():
    """
    API endpoint to browse directories for scenarios with security validation.
    
    Query Parameters:
        path (str): Directory path to browse (defaults to user home)
        search (str): Optional search term to filter directories
        
    Returns:
        JSON response with directory contents and metadata
        
    Raises:
        ValidationError: If path parameter is invalid
        PathTraversalError: If path traversal attack detected
        FileNotFoundError: If directory doesn't exist
        PermissionError: If directory not accessible
    """
    # Get and validate path parameter
    user_path = request.args.get('path', user_home)
    require_params(path=user_path)
    
    # Sanitize search term if provided
    search_term = request.args.get('search', '')
    if search_term:
        search_term = InputSanitizer.sanitize_search_term(search_term)
    
    with logger.performance("Directory browsing", {'path': user_path, 'search': search_term}):
        # Validate path with security checks
        validated_path = path_validator.validate_directory_path(user_path)
        
        logger.info("Browsing directory", {
            'requested_path': user_path,
            'validated_path': validated_path,
            'search_term': search_term
        })
        
        # Get directory contents with error handling
        contents = []
        try:
            directory_items = sorted(os.listdir(validated_path))
            
            for item in directory_items:
                item_path = os.path.join(validated_path, item)
                
                # Skip if not a directory
                if not os.path.isdir(item_path):
                    continue
                
                # Apply search filter if provided
                if search_term and search_term.lower() not in item.lower():
                    continue
                
                try:
                    # Check if directory is a valid scenario
                    is_scenario = scenario_loader.is_valid_scenario(item_path)
                    
                    contents.append({
                        'name': item,
                        'path': item_path,
                        'type': 'scenario' if is_scenario else 'directory',
                        'is_scenario': is_scenario
                    })
                    
                except Exception as e:
                    logger.warning(f"Error checking scenario validity for {item_path}", {
                        'item_path': item_path,
                        'error': str(e)
                    })
                    # Include as regular directory if scenario check fails
                    contents.append({
                        'name': item,
                        'path': item_path,
                        'type': 'directory',
                        'is_scenario': False
                    })
        
        except PermissionError as e:
            logger.warning(f"Permission denied accessing directory contents", {
                'path': validated_path,
                'error': str(e)
            })
            raise PermissionError(f"Cannot access directory contents: {validated_path}")
        
        # Calculate parent directory safely
        parent_path = None
        if validated_path != user_home:  # Don't go above allowed root
            potential_parent = os.path.dirname(validated_path)
            # Only set parent if it's within allowed root
            if path_validator._is_within_allowed_root(potential_parent):
                parent_path = potential_parent
        
        response_data = {
            'path': validated_path,
            'parent': parent_path,
            'contents': contents,
            'search_term': search_term,
            'total_items': len(contents)
        }
        
        logger.info("Directory browse completed", {
            'path': validated_path,
            'items_found': len(contents),
            'scenarios_found': sum(1 for item in contents if item['is_scenario'])
        })
        
        return jsonify(response_data)

@app.route('/api/scenario/load')
@handle_api_errors("Scenario loading")
def load_scenario():
    """
    Load a scenario and return its complete configuration data.
    
    Query Parameters:
        path (str): Path to the scenario directory
        
    Returns:
        JSON response with scenario metadata, files, and structure
        
    Raises:
        ValidationError: If path parameter is missing or invalid
        ScenarioNotFoundError: If scenario directory doesn't exist
        InvalidScenarioError: If directory is not a valid scenario
        ScenarioLoadError: If scenario files cannot be parsed
    """
    # Validate required parameters
    scenario_path = request.args.get('path')
    require_params(path=scenario_path)
    
    with logger.performance("Scenario loading", {'scenario_path': scenario_path}):
        # Validate path with security checks
        validated_path = path_validator.validate_directory_path(scenario_path)
        
        logger.info("Loading scenario", {
            'requested_path': scenario_path,
            'validated_path': validated_path
        })
        
        # Check if it's a valid scenario before attempting to load
        if not scenario_loader.is_valid_scenario(validated_path):
            raise InvalidScenarioError(
                validated_path,
                "Directory does not contain required scenario files"
            )
        
        # Load scenario data with detailed error handling
        scenario_data = scenario_loader.load_scenario(validated_path)
        
        logger.info("Scenario loaded successfully", {
            'scenario_name': scenario_data.get('metadata', {}).get('name', 'Unknown'),
            'scenario_path': validated_path,
            'files_loaded': len(scenario_data.get('files', {})),
            'has_structure': 'structure' in scenario_data
        })
        
        return jsonify(scenario_data)

@app.route('/api/scenario/preview')
def scenario_preview():
    """Get basic preview information for a scenario"""
    scenario_path = request.args.get('path')
    
    if not scenario_path:
        return jsonify({'error': 'No scenario path provided'}), 400
    
    try:
        preview_data = scenario_loader.get_scenario_preview(scenario_path)
        return jsonify(preview_data)
    except Exception as e:
        return jsonify({'error': f'Error getting scenario preview: {str(e)}'}), 500

@app.route('/api/logs', methods=['POST'])
def receive_logs():
    """Receive client-side logs and write them to file"""
    try:
        data = request.get_json()
        if not data or 'logs' not in data:
            return jsonify({'error': 'No logs provided'}), 400
        
        import os
        import datetime
        
        # Create logs directory if it doesn't exist
        logs_dir = os.path.join(os.path.dirname(__file__), 'logs')
        os.makedirs(logs_dir, exist_ok=True)
        
        # Write logs to file with date
        log_file = os.path.join(logs_dir, f'client-{datetime.date.today()}.log')
        
        with open(log_file, 'a', encoding='utf-8') as f:
            for log_entry in data['logs']:
                timestamp = log_entry.get('timestamp', '')
                level = log_entry.get('level', 'INFO').upper()
                message = log_entry.get('message', '')
                data_str = log_entry.get('data', '')
                url = log_entry.get('url', '')
                
                log_line = f"[{timestamp}] {level} - {url} - {message}"
                if data_str:
                    log_line += f" | Data: {data_str}"
                log_line += "\n"
                
                f.write(log_line)
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        print(f"Error writing logs: {e}")
        return jsonify({'error': f'Error writing logs: {str(e)}'}), 500

@app.route('/logs')
def view_logs():
    """View the current log file contents"""
    import os
    import datetime
    
    logs_dir = os.path.join(os.path.dirname(__file__), 'logs')
    log_file = os.path.join(logs_dir, f'client-{datetime.date.today()}.log')
    
    try:
        if os.path.exists(log_file):
            with open(log_file, 'r', encoding='utf-8') as f:
                content = f.read()
            return f"<pre>{content}</pre>"
        else:
            return f"<pre>No log file found at: {log_file}</pre>"
    except Exception as e:
        return f"<pre>Error reading logs: {e}</pre>"

@app.route('/scenario/<path:filename>')
def serve_scenario_file(filename):
    """Serve scenario files (like preview images)"""
    # This will be implemented when we need to serve scenario assets
    pass

if __name__ == '__main__':
    # Startup banner with security information
    logger.info("=" * 60)
    logger.info("🚀 EMPYRION SCENARIO EDITOR STARTING")
    logger.info("=" * 60)
    logger.info("🔒 Security Features Enabled:")
    logger.info(f"   • Path validation with allowed root: {user_home}")
    logger.info(f"   • File size limits: {path_validator.max_file_size // (1024*1024)}MB")
    logger.info(f"   • Directory depth limit: {path_validator.max_depth}")
    logger.info("🛡️ Error Handling:")
    logger.info("   • Structured exception handling")
    logger.info("   • Comprehensive logging system")
    logger.info("   • Safe DOM manipulation utilities")
    logger.info("🌐 Server Configuration:")
    logger.info("   • Host: 127.0.0.1")
    logger.info("   • Port: 5002")
    logger.info("   • Debug mode: Enabled")
    logger.info("   • Log directory: logs/")
    logger.info("=" * 60)
    logger.info("📁 Ready to browse and edit Empyrion scenarios!")
    logger.info("🌐 Access at: http://localhost:5002")
    logger.info("=" * 60)
    
    try:
        app.run(debug=True, host='127.0.0.1', port=5002)
    except Exception as e:
        logger.error("Fatal error starting Flask application", {
            'error': str(e),
            'error_type': e.__class__.__name__
        }, exc_info=True)
        raise