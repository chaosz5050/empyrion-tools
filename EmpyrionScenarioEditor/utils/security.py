"""
Security utilities for the Empyrion Scenario Editor.

This module provides secure path validation, input sanitization,
and other security-related functionality to prevent common attacks
like path traversal, file bombs, and malicious input.
"""

import os
import stat
from typing import Optional, List
from pathlib import Path


class SecurityError(Exception):
    """Base exception for security-related errors."""
    pass


class PathTraversalError(SecurityError):
    """Raised when path traversal attack is detected."""
    pass


class FileSizeError(SecurityError):
    """Raised when file size exceeds allowed limits."""
    pass


class PathValidator:
    """
    Secure path validation utilities to prevent directory traversal attacks
    and ensure file system operations stay within allowed boundaries.
    """
    
    # Default settings
    DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    DEFAULT_MAX_DIRECTORY_DEPTH = 10
    
    # Dangerous path components to block
    DANGEROUS_COMPONENTS = {'.', '..', '~', '$'}
    
    # File extensions to block (can be extended)
    BLOCKED_EXTENSIONS = {'.exe', '.bat', '.cmd', '.ps1', '.sh', '.py', '.js'}
    
    def __init__(self, 
                 allowed_root: Optional[str] = None,
                 max_file_size: int = DEFAULT_MAX_FILE_SIZE,
                 max_depth: int = DEFAULT_MAX_DIRECTORY_DEPTH):
        """
        Initialize path validator with security constraints.
        
        Args:
            allowed_root: Optional root directory to restrict all access to
            max_file_size: Maximum allowed file size in bytes
            max_depth: Maximum directory depth to prevent deep recursion
        """
        self.allowed_root = os.path.abspath(allowed_root) if allowed_root else None
        self.max_file_size = max_file_size
        self.max_depth = max_depth
    
    def validate_directory_path(self, user_path: str) -> str:
        """
        Validate and normalize directory path, preventing traversal attacks.
        
        Args:
            user_path: User-provided path string
            
        Returns:
            str: Validated absolute path
            
        Raises:
            ValueError: If path is invalid
            PathTraversalError: If path traversal detected
            FileNotFoundError: If directory doesn't exist
            PermissionError: If directory not accessible
        """
        if not user_path or not isinstance(user_path, str):
            raise ValueError("Path must be a non-empty string")
        
        # Remove null bytes and other dangerous characters
        sanitized_path = self._sanitize_path_string(user_path)
        
        # Expand user path and convert to absolute
        try:
            expanded_path = os.path.expanduser(sanitized_path)
            abs_path = os.path.abspath(expanded_path)
        except (OSError, ValueError) as e:
            raise ValueError(f"Invalid path format: {e}")
        
        # Check for path traversal attempts
        self._check_path_traversal(user_path, abs_path)
        
        # Validate against allowed root if specified
        if self.allowed_root and not self._is_within_allowed_root(abs_path):
            raise PathTraversalError(
                f"Path outside allowed directory: {abs_path} not within {self.allowed_root}"
            )
        
        # Validate path exists and is directory
        if not os.path.exists(abs_path):
            raise FileNotFoundError(f"Directory does not exist: {abs_path}")
        
        if not os.path.isdir(abs_path):
            raise ValueError(f"Path is not a directory: {abs_path}")
        
        # Check directory permissions
        if not os.access(abs_path, os.R_OK):
            raise PermissionError(f"Directory not readable: {abs_path}")
        
        # Check directory depth
        depth = len(Path(abs_path).parts)
        if depth > self.max_depth:
            raise ValueError(f"Directory depth {depth} exceeds maximum {self.max_depth}")
        
        return abs_path
    
    def validate_file_path(self, user_path: str, must_exist: bool = True) -> str:
        """
        Validate file path with security checks.
        
        Args:
            user_path: User-provided file path
            must_exist: Whether file must exist (default True)
            
        Returns:
            str: Validated absolute file path
            
        Raises:
            ValueError: If path is invalid
            PathTraversalError: If path traversal detected
            FileSizeError: If file too large
            FileNotFoundError: If file doesn't exist (when must_exist=True)
        """
        if not user_path or not isinstance(user_path, str):
            raise ValueError("File path must be a non-empty string")
        
        # Sanitize and normalize path
        sanitized_path = self._sanitize_path_string(user_path)
        abs_path = os.path.abspath(os.path.expanduser(sanitized_path))
        
        # Check for path traversal
        self._check_path_traversal(user_path, abs_path)
        
        # Validate against allowed root
        if self.allowed_root and not self._is_within_allowed_root(abs_path):
            raise PathTraversalError(f"File path outside allowed directory: {abs_path}")
        
        # Check file extension
        file_ext = os.path.splitext(abs_path)[1].lower()
        if file_ext in self.BLOCKED_EXTENSIONS:
            raise ValueError(f"File type not allowed: {file_ext}")
        
        if must_exist:
            if not os.path.exists(abs_path):
                raise FileNotFoundError(f"File does not exist: {abs_path}")
            
            if not os.path.isfile(abs_path):
                raise ValueError(f"Path is not a file: {abs_path}")
            
            # Check file size
            try:
                file_size = os.path.getsize(abs_path)
                if file_size > self.max_file_size:
                    raise FileSizeError(
                        f"File too large: {file_size} bytes (max: {self.max_file_size})"
                    )
            except OSError as e:
                raise PermissionError(f"Cannot access file: {abs_path} - {e}")
        
        return abs_path
    
    def _sanitize_path_string(self, path: str) -> str:
        """Remove dangerous characters from path string."""
        # Remove null bytes and control characters
        sanitized = ''.join(char for char in path if ord(char) >= 32)
        
        # Remove multiple consecutive slashes
        while '//' in sanitized:
            sanitized = sanitized.replace('//', '/')
        
        # Remove trailing slashes (except root)
        if len(sanitized) > 1 and sanitized.endswith('/'):
            sanitized = sanitized.rstrip('/')
        
        return sanitized
    
    def _check_path_traversal(self, original_path: str, resolved_path: str) -> None:
        """Check for path traversal attacks."""
        # Look for obvious traversal patterns in original path
        dangerous_patterns = ['../', '..\\', '../', '..\\\\']
        for pattern in dangerous_patterns:
            if pattern in original_path:
                raise PathTraversalError(f"Path traversal detected: {pattern} in {original_path}")
        
        # Check for dangerous path components
        path_parts = Path(original_path).parts
        for part in path_parts:
            if part in self.DANGEROUS_COMPONENTS:
                raise PathTraversalError(f"Dangerous path component: {part}")
    
    def _is_within_allowed_root(self, path: str) -> bool:
        """Check if path is within allowed root directory."""
        if not self.allowed_root:
            return True
        
        try:
            # Use os.path.commonpath to check if paths share common root
            common = os.path.commonpath([self.allowed_root, path])
            return common == self.allowed_root
        except (ValueError, OSError):
            return False


class InputSanitizer:
    """
    Input sanitization utilities for user-provided data.
    """
    
    @staticmethod
    def sanitize_filename(filename: str, max_length: int = 255) -> str:
        """
        Sanitize filename to prevent directory traversal and invalid characters.
        
        Args:
            filename: User-provided filename
            max_length: Maximum allowed filename length
            
        Returns:
            str: Sanitized filename
            
        Raises:
            ValueError: If filename is invalid after sanitization
        """
        if not filename or not isinstance(filename, str):
            raise ValueError("Filename must be a non-empty string")
        
        # Remove dangerous characters
        dangerous_chars = '<>:"/\\|?*\x00'
        sanitized = ''.join(char for char in filename if char not in dangerous_chars)
        
        # Remove control characters
        sanitized = ''.join(char for char in sanitized if ord(char) >= 32)
        
        # Trim whitespace
        sanitized = sanitized.strip()
        
        # Check length
        if len(sanitized) > max_length:
            raise ValueError(f"Filename too long: {len(sanitized)} > {max_length}")
        
        if not sanitized:
            raise ValueError("Filename is empty after sanitization")
        
        # Check for reserved names (Windows)
        reserved_names = {
            'CON', 'PRN', 'AUX', 'NUL',
            'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
            'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
        }
        
        if sanitized.upper() in reserved_names:
            raise ValueError(f"Filename uses reserved name: {sanitized}")
        
        return sanitized
    
    @staticmethod
    def sanitize_search_term(search_term: str, max_length: int = 100) -> str:
        """
        Sanitize search term for safe database/file operations.
        
        Args:
            search_term: User-provided search string
            max_length: Maximum allowed search term length
            
        Returns:
            str: Sanitized search term
        """
        if not search_term:
            return ""
        
        if not isinstance(search_term, str):
            search_term = str(search_term)
        
        # Remove control characters and null bytes
        sanitized = ''.join(char for char in search_term if ord(char) >= 32)
        
        # Limit length
        if len(sanitized) > max_length:
            sanitized = sanitized[:max_length]
        
        # Trim whitespace
        sanitized = sanitized.strip()
        
        return sanitized


def get_safe_temp_path(base_name: str) -> str:
    """
    Generate a safe temporary file path within the system temp directory.
    
    Args:
        base_name: Base name for the temporary file
        
    Returns:
        str: Safe temporary file path
        
    Raises:
        ValueError: If base_name is invalid
    """
    import tempfile
    import uuid
    
    # Sanitize base name
    safe_name = InputSanitizer.sanitize_filename(base_name)
    
    # Add unique suffix to prevent conflicts
    unique_name = f"{safe_name}_{uuid.uuid4().hex[:8]}"
    
    # Get system temp directory
    temp_dir = tempfile.gettempdir()
    
    return os.path.join(temp_dir, unique_name)