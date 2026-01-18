"""Logging system for image generator"""
import logging
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

class ImageGeneratorLogger:
    """Custom logger for image generation with structured logging"""
    
    def __init__(self, config_manager):
        """Initialize logger
        
        Args:
            config_manager: ConfigManager instance
        """
        self.config = config_manager
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Set up loggers
        self.generation_logger = self._setup_logger(
            'generation',
            self.config.get_log_dir('generation') / f'generation_{self.session_id}.log'
        )
        self.debug_logger = self._setup_logger(
            'debug',
            self.config.get_log_dir('debug') / f'debug_{self.session_id}.log'
        )
        
    def _setup_logger(self, name: str, log_file: Path) -> logging.Logger:
        """Set up a logger with file and console handlers
        
        Args:
            name: Logger name
            log_file: Path to log file
            
        Returns:
            Configured logger
        """
        logger = logging.getLogger(name)
        logger.setLevel(logging.DEBUG)
        logger.handlers = []  # Clear existing handlers
        
        # File handler
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.DEBUG)
        file_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
        
        # Console handler
        if self.config.get('logging.console_output', True):
            console_handler = logging.StreamHandler()
            console_handler.setLevel(getattr(logging, self.config.get('logging.level', 'INFO')))
            console_formatter = logging.Formatter('%(levelname)s: %(message)s')
            console_handler.setFormatter(console_formatter)
            logger.addHandler(console_handler)
        
        return logger
    
    def info(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log info message
        
        Args:
            message: Log message
            extra: Additional structured data
        """
        self.generation_logger.info(message)
        if extra and self.config.get('logging.json_logs', True):
            self._log_json('INFO', message, extra)
    
    def debug(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log debug message
        
        Args:
            message: Log message
            extra: Additional structured data
        """
        self.debug_logger.debug(message)
        if extra and self.config.get('logging.json_logs', True):
            self._log_json('DEBUG', message, extra)
    
    def warning(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log warning message
        
        Args:
            message: Log message
            extra: Additional structured data
        """
        self.generation_logger.warning(message)
        if extra and self.config.get('logging.json_logs', True):
            self._log_json('WARNING', message, extra)
    
    def error(self, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log error message
        
        Args:
            message: Log message
            extra: Additional structured data
        """
        self.generation_logger.error(message)
        if extra and self.config.get('logging.json_logs', True):
            self._log_json('ERROR', message, extra)
    
    def _log_json(self, level: str, message: str, data: Dict[str, Any]):
        """Log structured JSON data
        
        Args:
            level: Log level
            message: Log message
            data: Structured data to log
        """
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'session_id': self.session_id,
            'level': level,
            'message': message,
            'data': data
        }
        
        json_log_file = self.config.get_log_dir('debug') / f'structured_{self.session_id}.jsonl'
        with open(json_log_file, 'a') as f:
            f.write(json.dumps(log_entry) + '\n')
    
    def log_generation_start(self, category: str, prompt: str, count: int = 4):
        """Log start of image generation
        
        Args:
            category: Image category
            prompt: User prompt
            count: Number of images to generate
        """
        self.info(
            f"Starting generation: {count} images for category '{category}'",
            {
                'event': 'generation_start',
                'category': category,
                'prompt': prompt,
                'count': count
            }
        )
    
    def log_generation_complete(self, category: str, success_count: int, total_count: int):
        """Log completion of image generation
        
        Args:
            category: Image category
            success_count: Number of successful generations
            total_count: Total number attempted
        """
        self.info(
            f"Generation complete: {success_count}/{total_count} images successful",
            {
                'event': 'generation_complete',
                'category': category,
                'success_count': success_count,
                'total_count': total_count
            }
        )
    
    def log_api_call(self, prompt: str, response_time: float, success: bool):
        """Log API call details
        
        Args:
            prompt: Prompt sent to API
            response_time: Time taken for API call
            success: Whether call was successful
        """
        self.debug(
            f"API call {'successful' if success else 'failed'} ({response_time:.2f}s)",
            {
                'event': 'api_call',
                'prompt': prompt,
                'response_time': response_time,
                'success': success
            }
        )
    
    def log_validation(self, filename: str, passed: bool, details: Dict[str, Any]):
        """Log validation results
        
        Args:
            filename: Image filename
            passed: Whether validation passed
            details: Validation details
        """
        self.debug(
            f"Validation {'passed' if passed else 'failed'} for {filename}",
            {
                'event': 'validation',
                'filename': filename,
                'passed': passed,
                'details': details
            }
        )
