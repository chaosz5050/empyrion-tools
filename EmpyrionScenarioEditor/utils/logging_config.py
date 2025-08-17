"""
Comprehensive logging configuration for Empyrion Scenario Editor.

This module provides structured logging with performance tracking, context management,
and both file and console output with appropriate formatting.
"""

import logging
import logging.handlers
import os
import time
import json
import threading
from typing import Any, Dict, Optional, Union
from datetime import datetime
from functools import wraps
from contextlib import contextmanager


class ContextualFormatter(logging.Formatter):
    """
    Custom formatter that includes contextual information in log messages.
    """
    
    def __init__(self, include_context: bool = True):
        """
        Initialize formatter with optional context inclusion.
        
        Args:
            include_context: Whether to include context data in formatted output
        """
        super().__init__()
        self.include_context = include_context
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record with context information."""
        # Base format
        timestamp = datetime.fromtimestamp(record.created).strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        base_format = f"{timestamp} | {record.levelname:8} | {record.name:20} | {record.getMessage()}"
        
        # Add context if available
        if self.include_context and hasattr(record, 'context') and record.context:
            context_str = json.dumps(record.context, separators=(',', ':'))
            base_format += f" | Context: {context_str}"
        
        # Add performance info if available
        if hasattr(record, 'duration'):
            base_format += f" | Duration: {record.duration:.3f}s"
        
        # Add exception info if present
        if record.exc_info:
            base_format += f"\n{self.formatException(record.exc_info)}"
        
        return base_format


class PerformanceLogger:
    """
    Context manager for performance logging with detailed timing information.
    """
    
    def __init__(self, 
                 operation_name: str, 
                 logger: logging.Logger,
                 context: Optional[Dict[str, Any]] = None,
                 log_level: int = logging.INFO):
        """
        Initialize performance logger.
        
        Args:
            operation_name: Name of the operation being timed
            logger: Logger instance to use
            context: Additional context information
            log_level: Logging level for performance messages
        """
        self.operation_name = operation_name
        self.logger = logger
        self.context = context or {}
        self.log_level = log_level
        self.start_time = None
        self.end_time = None
    
    def __enter__(self):
        """Start timing the operation."""
        self.start_time = time.time()
        self.logger.log(
            self.log_level,
            f"Starting {self.operation_name}",
            extra={'context': self.context}
        )
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """End timing and log results."""
        self.end_time = time.time()
        duration = self.end_time - self.start_time
        
        if exc_type:
            self.logger.error(
                f"{self.operation_name} failed after {duration:.3f}s: {exc_val}",
                extra={'context': self.context, 'duration': duration},
                exc_info=True
            )
        else:
            # Determine log level based on duration
            if duration > 5.0:
                level = logging.WARNING  # Slow operations
            elif duration > 1.0:
                level = logging.INFO
            else:
                level = logging.DEBUG
            
            self.logger.log(
                level,
                f"{self.operation_name} completed successfully",
                extra={'context': self.context, 'duration': duration}
            )
    
    def add_context(self, **kwargs):
        """Add additional context to the performance logger."""
        self.context.update(kwargs)


class ContextualLogger:
    """
    Logger wrapper that maintains thread-local context information.
    """
    
    def __init__(self, logger: logging.Logger):
        """
        Initialize contextual logger.
        
        Args:
            logger: Base logger instance
        """
        self.logger = logger
        self.local_context = threading.local()
    
    def set_context(self, **kwargs):
        """Set context for current thread."""
        if not hasattr(self.local_context, 'data'):
            self.local_context.data = {}
        self.local_context.data.update(kwargs)
    
    def clear_context(self):
        """Clear context for current thread."""
        if hasattr(self.local_context, 'data'):
            self.local_context.data.clear()
    
    def get_context(self) -> Dict[str, Any]:
        """Get current thread's context."""
        if hasattr(self.local_context, 'data'):
            return self.local_context.data.copy()
        return {}
    
    def _log_with_context(self, level: int, message: str, context: Optional[Dict[str, Any]] = None):
        """Log message with context information."""
        # Merge thread context with provided context
        full_context = self.get_context()
        if context:
            full_context.update(context)
        
        extra = {'context': full_context} if full_context else {}
        self.logger.log(level, message, extra=extra)
    
    def debug(self, message: str, context: Optional[Dict[str, Any]] = None):
        """Log debug message with context."""
        self._log_with_context(logging.DEBUG, message, context)
    
    def info(self, message: str, context: Optional[Dict[str, Any]] = None):
        """Log info message with context."""
        self._log_with_context(logging.INFO, message, context)
    
    def warning(self, message: str, context: Optional[Dict[str, Any]] = None):
        """Log warning message with context."""
        self._log_with_context(logging.WARNING, message, context)
    
    def error(self, message: str, context: Optional[Dict[str, Any]] = None, exc_info: bool = False):
        """Log error message with context."""
        full_context = self.get_context()
        if context:
            full_context.update(context)
        
        extra = {'context': full_context} if full_context else {}
        self.logger.error(message, extra=extra, exc_info=exc_info)
    
    def performance(self, operation_name: str, context: Optional[Dict[str, Any]] = None) -> PerformanceLogger:
        """Create performance logger for operation."""
        return PerformanceLogger(operation_name, self.logger, context)


def setup_logging(
    log_level: Union[int, str] = logging.INFO,
    log_directory: str = "logs",
    max_file_size: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5,
    enable_console: bool = True,
    enable_file: bool = True
) -> ContextualLogger:
    """
    Set up comprehensive logging configuration.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        log_directory: Directory to store log files
        max_file_size: Maximum size of each log file in bytes
        backup_count: Number of backup log files to keep
        enable_console: Whether to enable console logging
        enable_file: Whether to enable file logging
        
    Returns:
        ContextualLogger instance for the application
    """
    # Convert string log level to int
    if isinstance(log_level, str):
        log_level = getattr(logging, log_level.upper())
    
    # Create logs directory if it doesn't exist
    if enable_file:
        os.makedirs(log_directory, exist_ok=True)
    
    # Create root logger
    root_logger = logging.getLogger('empyrion_editor')
    root_logger.setLevel(log_level)
    
    # Clear any existing handlers
    root_logger.handlers.clear()
    
    # Create formatters
    console_formatter = ContextualFormatter(include_context=False)  # Simpler console output
    file_formatter = ContextualFormatter(include_context=True)      # Full context in files
    
    # Console handler
    if enable_console:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(log_level)
        console_handler.setFormatter(console_formatter)
        root_logger.addHandler(console_handler)
    
    # File handlers
    if enable_file:
        # Main application log
        app_log_path = os.path.join(log_directory, 'empyrion_editor.log')
        app_handler = logging.handlers.RotatingFileHandler(
            app_log_path,
            maxBytes=max_file_size,
            backupCount=backup_count,
            encoding='utf-8'
        )
        app_handler.setLevel(log_level)
        app_handler.setFormatter(file_formatter)
        root_logger.addHandler(app_handler)
        
        # Error-only log for critical issues
        error_log_path = os.path.join(log_directory, 'errors.log')
        error_handler = logging.handlers.RotatingFileHandler(
            error_log_path,
            maxBytes=max_file_size,
            backupCount=backup_count,
            encoding='utf-8'
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(file_formatter)
        root_logger.addHandler(error_handler)
        
        # Performance log for slow operations
        perf_log_path = os.path.join(log_directory, 'performance.log')
        perf_handler = logging.handlers.RotatingFileHandler(
            perf_log_path,
            maxBytes=max_file_size,
            backupCount=backup_count,
            encoding='utf-8'
        )
        
        # Custom filter for performance logs
        class PerformanceFilter(logging.Filter):
            def filter(self, record):
                return hasattr(record, 'duration') or 'performance' in record.getMessage().lower()
        
        perf_handler.addFilter(PerformanceFilter())
        perf_handler.setLevel(logging.INFO)
        perf_handler.setFormatter(file_formatter)
        root_logger.addHandler(perf_handler)
    
    # Create contextual logger
    contextual_logger = ContextualLogger(root_logger)
    
    # Log startup message
    contextual_logger.info("Logging system initialized", {
        'log_level': logging.getLevelName(log_level),
        'log_directory': log_directory if enable_file else 'disabled',
        'console_logging': enable_console,
        'file_logging': enable_file
    })
    
    return contextual_logger


def logged_function(operation_name: Optional[str] = None, 
                   log_level: int = logging.INFO,
                   include_args: bool = False):
    """
    Decorator to automatically log function calls with performance timing.
    
    Args:
        operation_name: Custom name for the operation (defaults to function name)
        log_level: Logging level for the operation
        include_args: Whether to include function arguments in context
        
    Returns:
        Decorated function
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Get logger
            logger = logging.getLogger('empyrion_editor')
            
            # Determine operation name
            op_name = operation_name or f"{func.__module__}.{func.__name__}"
            
            # Build context
            context = {'function': func.__name__, 'module': func.__module__}
            if include_args and args:
                context['args'] = str(args)[:200]  # Limit argument string length
            if include_args and kwargs:
                context['kwargs'] = {k: str(v)[:50] for k, v in kwargs.items()}
            
            # Use performance logger
            with PerformanceLogger(op_name, logger, context, log_level):
                return func(*args, **kwargs)
        
        return wrapper
    return decorator


@contextmanager
def log_context(**context_data):
    """
    Context manager to temporarily set logging context.
    
    Args:
        **context_data: Context key-value pairs
        
    Example:
        with log_context(user_id='123', operation='load_scenario'):
            # All logging within this block includes the context
            logger.info("Starting operation")
    """
    logger = logging.getLogger('empyrion_editor')
    if isinstance(logger, ContextualLogger):
        # Save current context
        old_context = logger.get_context()
        
        try:
            # Set new context
            logger.set_context(**context_data)
            yield
        finally:
            # Restore old context
            logger.clear_context()
            if old_context:
                logger.set_context(**old_context)
    else:
        # Fallback for non-contextual loggers
        yield


# Pre-configured logger instance for easy import
logger: Optional[ContextualLogger] = None


def get_logger() -> ContextualLogger:
    """
    Get the application logger instance.
    
    Returns:
        ContextualLogger instance
        
    Raises:
        RuntimeError: If logging has not been initialized
    """
    global logger
    if logger is None:
        raise RuntimeError("Logging not initialized. Call setup_logging() first.")
    return logger


def init_logging(**kwargs) -> ContextualLogger:
    """
    Initialize logging and set global logger instance.
    
    Args:
        **kwargs: Arguments passed to setup_logging()
        
    Returns:
        ContextualLogger instance
    """
    global logger
    logger = setup_logging(**kwargs)
    return logger