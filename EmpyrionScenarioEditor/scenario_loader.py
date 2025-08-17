#!/usr/bin/env python3
"""
Scenario Loader Module

Handles detection, validation, and loading of Empyrion scenario configurations.
Parses YAML files, validates scenario structure, and extracts metadata with
comprehensive error handling and security validation.
"""

import os
import yaml
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any

# Import our security and error handling utilities
from utils.security import PathValidator, InputSanitizer, FileSizeError
from utils.exceptions import (
    ScenarioError, InvalidScenarioError, ScenarioNotFoundError, 
    ScenarioLoadError, YAMLParsingError, FileAccessError,
    ErrorHandler
)
from utils.logging_config import get_logger, log_context, logged_function

class ScenarioLoader:
    """
    Handles loading and parsing of Empyrion scenarios with comprehensive 
    error handling, security validation, and performance monitoring.
    
    Features:
    - Secure file access with path validation
    - Structured error handling with detailed context
    - Performance monitoring and logging
    - Memory-safe YAML parsing with size limits
    - Graceful handling of corrupted or partial scenarios
    """
    
    def __init__(self, max_file_size: int = 10 * 1024 * 1024):  # 10MB default
        """
        Initialize the scenario loader with security constraints.
        
        Args:
            max_file_size: Maximum allowed file size in bytes for YAML parsing
        """
        self.logger = get_logger()
        self.error_handler = ErrorHandler(self.logger)
        
        # File validation settings
        self.max_file_size = max_file_size
        self.path_validator = PathValidator(max_file_size=max_file_size)
        
        # Required files for a valid scenario
        self.required_files = [
            'gameoptions.yaml',
            'description.txt'
        ]
        
        # Optional files that enhance scenario functionality
        self.optional_files = [
            'SolarSystemConfig.yaml',
            'RandomSolarSystemConfig.yaml',
            'preview.jpg',
            'preview.png',
            'playfield.yaml'
        ]
        
        # File size limits for different file types
        self.file_size_limits = {
            '.yaml': 10 * 1024 * 1024,    # 10MB for YAML files
            '.yml': 10 * 1024 * 1024,     # 10MB for YML files  
            '.txt': 1 * 1024 * 1024,      # 1MB for text files
            '.jpg': 5 * 1024 * 1024,      # 5MB for images
            '.png': 5 * 1024 * 1024,      # 5MB for images
        }
        
        self.logger.info("ScenarioLoader initialized", {
            'max_file_size': max_file_size,
            'required_files': len(self.required_files),
            'optional_files': len(self.optional_files)
        })
    
    @logged_function("Scenario validation", include_args=True)
    def is_valid_scenario(self, directory_path: str) -> bool:
        """
        Check if a directory contains a valid Empyrion scenario.
        
        Performs comprehensive validation including:
        - Directory existence and accessibility
        - Required file presence
        - Basic file integrity checks
        - File size validation
        
        Args:
            directory_path (str): Path to directory to check
            
        Returns:
            bool: True if directory contains a valid scenario, False otherwise
            
        Note:
            This method is designed to be non-throwing for use in directory browsing.
            Detailed validation errors are logged but don't raise exceptions.
        """
        try:
            # Validate directory path
            if not directory_path or not isinstance(directory_path, str):
                self.logger.debug("Invalid directory path type", {'path': directory_path})
                return False
            
            # Check if directory exists and is accessible
            if not os.path.exists(directory_path):
                self.logger.debug("Directory does not exist", {'path': directory_path})
                return False
                
            if not os.path.isdir(directory_path):
                self.logger.debug("Path is not a directory", {'path': directory_path})
                return False
            
            # Check directory access permissions
            if not os.access(directory_path, os.R_OK):
                self.logger.debug("Directory not readable", {'path': directory_path})
                return False
            
            # Validate required files exist and are accessible
            missing_files = []
            for required_file in self.required_files:
                file_path = os.path.join(directory_path, required_file)
                
                if not os.path.exists(file_path):
                    missing_files.append(required_file)
                    continue
                
                # Check if file is readable
                if not os.access(file_path, os.R_OK):
                    self.logger.debug(f"Required file not readable: {required_file}", {
                        'file_path': file_path,
                        'scenario_path': directory_path
                    })
                    return False
                
                # Basic file size check
                try:
                    file_size = os.path.getsize(file_path)
                    file_ext = os.path.splitext(required_file)[1].lower()
                    size_limit = self.file_size_limits.get(file_ext, self.max_file_size)
                    
                    if file_size > size_limit:
                        self.logger.warning(f"Required file too large: {required_file}", {
                            'file_path': file_path,
                            'file_size': file_size,
                            'size_limit': size_limit,
                            'scenario_path': directory_path
                        })
                        return False
                        
                except OSError as e:
                    self.logger.debug(f"Cannot check size of required file: {required_file}", {
                        'file_path': file_path,
                        'error': str(e),
                        'scenario_path': directory_path
                    })
                    return False
            
            # If any required files are missing, scenario is invalid
            if missing_files:
                self.logger.debug("Scenario missing required files", {
                    'scenario_path': directory_path,
                    'missing_files': missing_files
                })
                return False
            
            # Additional validation: check if gameoptions.yml is parseable YAML
            gameoptions_path = os.path.join(directory_path, 'gameoptions.yaml')
            try:
                with open(gameoptions_path, 'r', encoding='utf-8') as f:
                    content = f.read(1024)  # Read first 1KB to check basic validity
                    if not content.strip():
                        self.logger.debug("gameoptions.yaml is empty", {
                            'scenario_path': directory_path
                        })
                        return False
                        
            except Exception as e:
                self.logger.debug("Cannot validate gameoptions.yaml", {
                    'scenario_path': directory_path,
                    'error': str(e)
                })
                return False
            
            self.logger.debug("Scenario validation successful", {
                'scenario_path': directory_path
            })
            return True
            
        except Exception as e:
            # Log unexpected errors but don't throw - this is used in directory browsing
            self.logger.warning("Unexpected error during scenario validation", {
                'scenario_path': directory_path,
                'error': str(e)
            })
            return False
    
    def get_scenario_preview(self, scenario_path: str) -> Dict[str, Any]:
        """
        Get basic preview information for a scenario.
        
        Args:
            scenario_path (str): Path to scenario directory
            
        Returns:
            Dict containing preview information
        """
        if not self.is_valid_scenario(scenario_path):
            raise ValueError(f"Invalid scenario directory: {scenario_path}")
        
        preview_data = {
            'name': os.path.basename(scenario_path),
            'path': scenario_path,
            'description': '',
            'preview_image': None,
            'game_mode': 'Unknown',
            'multiplayer_ready': False
        }
        
        # Read description
        desc_path = os.path.join(scenario_path, 'description.txt')
        if os.path.exists(desc_path):
            try:
                with open(desc_path, 'r', encoding='utf-8') as f:
                    preview_data['description'] = f.read().strip()
            except:
                preview_data['description'] = 'Error reading description'
        
        # Check for preview image
        for img_ext in ['jpg', 'png']:
            img_path = os.path.join(scenario_path, f'preview.{img_ext}')
            if os.path.exists(img_path):
                preview_data['preview_image'] = f'preview.{img_ext}'
                break
        
        # Quick check of game options for multiplayer support
        try:
            gameoptions = self._load_yaml_file(os.path.join(scenario_path, 'gameoptions.yaml'))
            if gameoptions and 'Options' in gameoptions:
                for option_set in gameoptions['Options']:
                    if 'ValidFor' in option_set:
                        valid_for = option_set['ValidFor']
                        if 'MP' in valid_for:
                            preview_data['multiplayer_ready'] = True
                        if 'SP' in valid_for and 'Creative' in valid_for:
                            preview_data['game_mode'] = 'Single Player'
                        elif 'MP' in valid_for:
                            preview_data['game_mode'] = 'Multiplayer'
        except:
            pass  # Continue with default values if parsing fails
        
        return preview_data
    
    def load_scenario(self, scenario_path: str) -> Dict[str, Any]:
        """
        Load complete scenario configuration.
        
        Args:
            scenario_path (str): Path to scenario directory
            
        Returns:
            Dict containing complete scenario data
        """
        if not self.is_valid_scenario(scenario_path):
            raise ValueError(f"Invalid scenario directory: {scenario_path}")
        
        scenario_data = {
            'metadata': self.get_scenario_preview(scenario_path),
            'files': {},
            'structure': self._analyze_scenario_structure(scenario_path)
        }
        
        # Load key configuration files
        config_files = {
            'gameoptions.yaml': 'Game Options',
            'SolarSystemConfig.yaml': 'Solar System Config',
            'RandomPresets/SolarSystemConfig.yaml': 'Random Solar System Config'
        }
        
        for file_path, file_name in config_files.items():
            full_path = os.path.join(scenario_path, file_path)
            if os.path.exists(full_path):
                try:
                    if file_path.endswith('.yaml'):
                        scenario_data['files'][file_name] = {
                            'type': 'yaml',
                            'path': file_path,
                            'content': self._load_yaml_file(full_path)
                        }
                    else:
                        with open(full_path, 'r', encoding='utf-8') as f:
                            scenario_data['files'][file_name] = {
                                'type': 'text',
                                'path': file_path,
                                'content': f.read()
                            }
                except Exception as e:
                    scenario_data['files'][file_name] = {
                        'type': 'error',
                        'path': file_path,
                        'error': str(e)
                    }
        
        return scenario_data
    
    def _load_yaml_file(self, file_path: str) -> Optional[Dict]:
        """
        Load and parse a YAML file.
        
        Args:
            file_path (str): Path to YAML file
            
        Returns:
            Dict containing parsed YAML data or None if failed
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except Exception:
            return None
    
    def _analyze_scenario_structure(self, scenario_path: str) -> Dict[str, Any]:
        """
        Analyze the structure of a scenario directory.
        
        Args:
            scenario_path (str): Path to scenario directory
            
        Returns:
            Dict containing structure analysis
        """
        structure = {
            'directories': [],
            'files': [],
            'playfields_count': 0,
            'prefabs_count': 0,
            'has_content': False,
            'has_custom_configs': False
        }
        
        try:
            for root, dirs, files in os.walk(scenario_path):
                rel_path = os.path.relpath(root, scenario_path)
                
                if rel_path == '.':
                    structure['files'].extend(files)
                else:
                    structure['directories'].append(rel_path)
                
                # Count specific types
                if 'Playfields' in rel_path:
                    structure['playfields_count'] += len([d for d in dirs if not d.startswith('.')])
                elif 'Prefabs' in rel_path:
                    structure['prefabs_count'] += len([f for f in files if f.endswith('.epb')])
                elif 'Content' in rel_path:
                    structure['has_content'] = True
                    if any(f.endswith('.ecf') for f in files):
                        structure['has_custom_configs'] = True
        
        except Exception:
            pass  # Return partial structure if analysis fails
        
        return structure