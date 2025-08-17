"""
Custom exception hierarchy and error handling utilities for Empyrion Scenario Editor.

This module provides structured exception handling with specific error types,
context preservation, and user-friendly error messages.
"""

from typing import Any, Dict, Optional, Union
import traceback
import logging


class EmpyrionEditorError(Exception):
    """
    Base exception for all Empyrion Scenario Editor errors.
    
    Provides structured error information with context and user-friendly messages.
    """
    
    def __init__(self, 
                 message: str,
                 user_message: Optional[str] = None,
                 context: Optional[Dict[str, Any]] = None,
                 cause: Optional[Exception] = None):
        """
        Initialize structured error with context.
        
        Args:
            message: Technical error message for developers/logs
            user_message: User-friendly message for display (optional)
            context: Additional context information (optional)
            cause: Original exception that caused this error (optional)
        """
        super().__init__(message)
        self.user_message = user_message or message
        self.context = context or {}
        self.cause = cause
        self.error_code = self.__class__.__name__
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for JSON serialization."""
        return {
            'error_code': self.error_code,
            'message': str(self),
            'user_message': self.user_message,
            'context': self.context,
            'cause': str(self.cause) if self.cause else None
        }


class ScenarioError(EmpyrionEditorError):
    """Base class for scenario-related errors."""
    pass


class InvalidScenarioError(ScenarioError):
    """Raised when scenario directory is invalid or corrupted."""
    
    def __init__(self, scenario_path: str, reason: str, **kwargs):
        message = f"Invalid scenario at '{scenario_path}': {reason}"
        user_message = f"The scenario at '{scenario_path}' is not valid: {reason}"
        context = {'scenario_path': scenario_path, 'reason': reason}
        super().__init__(message, user_message, context, **kwargs)


class ScenarioNotFoundError(ScenarioError):
    """Raised when scenario directory cannot be found."""
    
    def __init__(self, scenario_path: str, **kwargs):
        message = f"Scenario not found: {scenario_path}"
        user_message = f"Could not find scenario at '{scenario_path}'"
        context = {'scenario_path': scenario_path}
        super().__init__(message, user_message, context, **kwargs)


class ScenarioLoadError(ScenarioError):
    """Raised when scenario fails to load due to file parsing errors."""
    
    def __init__(self, scenario_path: str, file_path: str, reason: str, **kwargs):
        message = f"Failed to load scenario '{scenario_path}': Error in file '{file_path}' - {reason}"
        user_message = f"Could not load scenario: Problem with file '{file_path}'"
        context = {
            'scenario_path': scenario_path,
            'file_path': file_path,
            'reason': reason
        }
        super().__init__(message, user_message, context, **kwargs)


class FileParsingError(EmpyrionEditorError):
    """Base class for file parsing errors."""
    pass


class YAMLParsingError(FileParsingError):
    """Raised when YAML file parsing fails."""
    
    def __init__(self, file_path: str, yaml_error: str, line_number: Optional[int] = None, **kwargs):
        message = f"YAML parsing error in '{file_path}': {yaml_error}"
        user_message = f"Configuration file '{file_path}' has invalid syntax"
        context = {
            'file_path': file_path,
            'yaml_error': yaml_error,
            'line_number': line_number
        }
        if line_number:
            message += f" at line {line_number}"
            user_message += f" (line {line_number})"
        
        super().__init__(message, user_message, context, **kwargs)


class FileAccessError(EmpyrionEditorError):
    """Raised when file cannot be accessed due to permissions or I/O errors."""
    
    def __init__(self, file_path: str, operation: str, system_error: str, **kwargs):
        message = f"Cannot {operation} file '{file_path}': {system_error}"
        user_message = f"Unable to {operation} '{file_path}' - check file permissions"
        context = {
            'file_path': file_path,
            'operation': operation,
            'system_error': system_error
        }
        super().__init__(message, user_message, context, **kwargs)


class ValidationError(EmpyrionEditorError):
    """Raised when input validation fails."""
    
    def __init__(self, field_name: str, value: Any, reason: str, **kwargs):
        message = f"Validation failed for '{field_name}' with value '{value}': {reason}"
        user_message = f"Invalid {field_name}: {reason}"
        context = {
            'field_name': field_name,
            'value': str(value),
            'reason': reason
        }
        super().__init__(message, user_message, context, **kwargs)


class ConfigurationError(EmpyrionEditorError):
    """Raised when configuration is invalid or missing."""
    pass


class ResourceLimitError(EmpyrionEditorError):
    """Raised when resource limits are exceeded."""
    
    def __init__(self, resource_type: str, current_value: Union[int, str], 
                 limit: Union[int, str], **kwargs):
        message = f"{resource_type} limit exceeded: {current_value} > {limit}"
        user_message = f"Operation cancelled: {resource_type.lower()} limit exceeded"
        context = {
            'resource_type': resource_type,
            'current_value': str(current_value),
            'limit': str(limit)
        }
        super().__init__(message, user_message, context, **kwargs)


class ErrorHandler:
    """
    Centralized error handling and logging utility.
    
    Provides consistent error processing, logging, and user-friendly error responses.
    """
    
    def __init__(self, logger: logging.Logger):
        """
        Initialize error handler with logger.
        
        Args:
            logger: Logger instance for error reporting
        """
        self.logger = logger
    
    def handle_error(self, 
                    error: Exception, 
                    context: Optional[Dict[str, Any]] = None,
                    log_level: int = logging.ERROR) -> Dict[str, Any]:
        """
        Handle error with logging and structured response.
        
        Args:
            error: Exception to handle
            context: Additional context information
            log_level: Logging level for this error
            
        Returns:
            Dict containing structured error information
        """
        # Merge context
        error_context = {}
        if hasattr(error, 'context'):
            error_context.update(error.context)
        if context:
            error_context.update(context)
        
        # Log error with full context
        log_message = f"{error.__class__.__name__}: {str(error)}"
        if error_context:
            log_message += f" | Context: {error_context}"
        
        if log_level >= logging.ERROR:
            self.logger.error(log_message, exc_info=True)
        elif log_level >= logging.WARNING:
            self.logger.warning(log_message)
        else:
            self.logger.info(log_message)
        
        # Return structured error response
        if isinstance(error, EmpyrionEditorError):
            return error.to_dict()
        else:
            # Handle unexpected errors
            return {
                'error_code': 'UnexpectedError',
                'message': str(error),
                'user_message': 'An unexpected error occurred. Please try again.',
                'context': error_context,
                'cause': None
            }
    
    def wrap_file_operation(self, operation_name: str, file_path: str):
        """
        Decorator to wrap file operations with consistent error handling.
        
        Args:
            operation_name: Description of the operation (e.g., "read", "write")
            file_path: Path to the file being operated on
            
        Returns:
            Decorator function
        """
        def decorator(func):
            def wrapper(*args, **kwargs):
                try:
                    return func(*args, **kwargs)
                except FileNotFoundError as e:
                    raise FileAccessError(file_path, operation_name, str(e), cause=e)
                except PermissionError as e:
                    raise FileAccessError(file_path, operation_name, str(e), cause=e)
                except OSError as e:
                    raise FileAccessError(file_path, operation_name, str(e), cause=e)
                except Exception as e:
                    self.logger.error(f"Unexpected error in {operation_name} operation on {file_path}: {e}")
                    raise
            return wrapper
        return decorator


def create_error_response(error: Exception, 
                         context: Optional[Dict[str, Any]] = None) -> tuple[Dict[str, Any], int]:
    """
    Create Flask-compatible error response from exception.
    
    Args:
        error: Exception to convert
        context: Additional context information
        
    Returns:
        Tuple of (error_dict, http_status_code)
    """
    # Map exception types to HTTP status codes
    status_code_map = {
        ValidationError: 400,
        InvalidScenarioError: 400,
        ScenarioNotFoundError: 404,
        FileAccessError: 403,
        ResourceLimitError: 413,
        YAMLParsingError: 422,
        ConfigurationError: 500,
    }
    
    # Determine status code
    status_code = 500  # Default to internal server error
    for error_type, code in status_code_map.items():
        if isinstance(error, error_type):
            status_code = code
            break
    
    # Create error response
    if isinstance(error, EmpyrionEditorError):
        error_dict = error.to_dict()
    else:
        error_dict = {
            'error_code': 'UnexpectedError',
            'message': str(error),
            'user_message': 'An unexpected error occurred',
            'context': context or {},
            'cause': None
        }
    
    return error_dict, status_code


# Utility function for validating required parameters
def require_params(**required_params) -> None:
    """
    Validate that required parameters are present and not None.
    
    Args:
        **required_params: Dictionary of parameter_name -> value pairs
        
    Raises:
        ValidationError: If any required parameter is missing or None
        
    Example:
        require_params(scenario_path=path, file_name=name)
    """
    for param_name, param_value in required_params.items():
        if param_value is None:
            raise ValidationError(param_name, param_value, "is required")
        if isinstance(param_value, str) and not param_value.strip():
            raise ValidationError(param_name, param_value, "cannot be empty")