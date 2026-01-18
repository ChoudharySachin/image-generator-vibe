"""Configuration Manager for Image Generator"""
import yaml
import os
from pathlib import Path
from typing import Dict, Any, Optional
from dotenv import load_dotenv

class ConfigManager:
    """Manages configuration loading and access"""
    
    def __init__(self, config_dir: str = None):
        """Initialize configuration manager
        
        Args:
            config_dir: Path to configuration directory
        """
        if config_dir is None:
            # Default to config directory relative to this file
            base_dir = Path(__file__).parent.parent
            config_dir = base_dir / "config"
        
        self.config_dir = Path(config_dir)
        self.base_dir = self.config_dir.parent
        
        # Load environment variables
        env_file = self.base_dir / ".env"
        if env_file.exists():
            load_dotenv(env_file)
        
        # Load configurations
        self.default_config = self._load_yaml("default_config.yaml")
        self.categories_config = self._load_yaml("image_categories.yaml")
        
    def _load_yaml(self, filename: str) -> Dict[str, Any]:
        """Load YAML configuration file
        
        Args:
            filename: Name of YAML file to load
            
        Returns:
            Dictionary of configuration values
        """
        filepath = self.config_dir / filename
        if not filepath.exists():
            raise FileNotFoundError(f"Configuration file not found: {filepath}")
        
        with open(filepath, 'r') as f:
            return yaml.safe_load(f)
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value with dot notation support
        
        Args:
            key: Configuration key (supports dot notation like 'api.model')
            default: Default value if key not found
            
        Returns:
            Configuration value
        """
        keys = key.split('.')
        value = self.default_config
        
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        
        return value
    
    def get_category(self, category_name: str) -> Dict[str, Any]:
        """Get category configuration
        
        Args:
            category_name: Name of the category
            
        Returns:
            Category configuration dictionary
        """
        categories = self.categories_config.get('categories', {})
        if category_name not in categories:
            raise ValueError(f"Unknown category: {category_name}")
        
        return categories[category_name]
    
    def get_all_categories(self) -> Dict[str, Dict[str, Any]]:
        """Get all category configurations
        
        Returns:
            Dictionary of all categories
        """
        return self.categories_config.get('categories', {})
    
    def get_api_key(self) -> Optional[str]:
        """Get Google AI API key from environment
        
        Returns:
            API key string or None if not found
        """
        return os.getenv('GOOGLE_API_KEY')
    
    def get_reference_dir(self, category_name: str) -> Path:
        """Get reference images directory for a category
        
        Args:
            category_name: Name of the category
            
        Returns:
            Path to reference images directory
        """
        category = self.get_category(category_name)
        ref_dir = self.base_dir / category['reference_dir'] / 'images'
        return ref_dir
    
    def get_description_file(self, category_name: str) -> Path:
        """Get description file path for a category
        
        Args:
            category_name: Name of the category
            
        Returns:
            Path to description.txt file
        """
        category = self.get_category(category_name)
        desc_file = self.base_dir / category['reference_dir'] / 'description.txt'
        return desc_file
    
    def get_output_dir(self) -> Path:
        """Get output directory for generated images
        
        Returns:
            Path to output directory
        """
        output_dir = self.base_dir / self.get('output.base_dir', 'output/generated_images')
        output_dir.mkdir(parents=True, exist_ok=True)
        return output_dir
    
    def get_log_dir(self, log_type: str = 'generation') -> Path:
        """Get log directory
        
        Args:
            log_type: Type of log ('generation' or 'debug')
            
        Returns:
            Path to log directory
        """
        if log_type == 'generation':
            log_dir = self.base_dir / self.get('logging.generation_log_dir', 'logs/generation_logs')
        else:
            log_dir = self.base_dir / self.get('logging.debug_log_dir', 'logs/debug_logs')
        
        log_dir.mkdir(parents=True, exist_ok=True)
        return log_dir
    
    def is_dry_run(self) -> bool:
        """Check if dry-run mode is enabled
        
        Returns:
            True if dry-run mode is enabled
        """
        # Check environment variable first
        env_dry_run = os.getenv('DRY_RUN', '').lower()
        if env_dry_run in ('true', '1', 'yes'):
            return True
        
        # Fall back to config
        return self.get('generation.dry_run', False)
