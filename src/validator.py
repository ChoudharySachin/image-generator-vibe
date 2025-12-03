"""Validation system for generated images"""
from PIL import Image
import io
from pathlib import Path
from typing import Dict, Any, Tuple, Optional

class ImageValidator:
    """Validates generated images against specifications"""
    
    def __init__(self, config_manager, logger):
        """Initialize validator
        
        Args:
            config_manager: ConfigManager instance
            logger: ImageGeneratorLogger instance
        """
        self.config = config_manager
        self.logger = logger
    
    def validate_image(self, image_data: bytes, category: str, filename: str) -> Tuple[bool, Dict[str, Any]]:
        """Validate an image
        
        Args:
            image_data: Image bytes
            category: Image category
            filename: Image filename
            
        Returns:
            Tuple of (passed, details_dict)
        """
        if image_data is None:
            return False, {'error': 'No image data'}
        
        details = {}
        passed = True
        
        try:
            # Load image
            image = Image.open(io.BytesIO(image_data))
            
            # Get expected dimensions
            category_config = self.config.get_category(category)
            expected_width = category_config['width']
            expected_height = category_config['height']
            expected_ratio = expected_width / expected_height
            
            # Check dimensions
            actual_width, actual_height = image.size
            actual_ratio = actual_width / actual_height
            
            details['width'] = actual_width
            details['height'] = actual_height
            details['expected_width'] = expected_width
            details['expected_height'] = expected_height
            details['aspect_ratio'] = f"{actual_width}:{actual_height}"
            details['expected_aspect_ratio'] = category_config['aspect_ratio']
            
            # Check aspect ratio with tolerance
            if self.config.get('validation.check_aspect_ratio', True):
                tolerance = self.config.get('validation.aspect_ratio_tolerance', 0.05)
                ratio_diff = abs(actual_ratio - expected_ratio) / expected_ratio
                
                details['aspect_ratio_match'] = ratio_diff <= tolerance
                details['aspect_ratio_difference'] = f"{ratio_diff * 100:.2f}%"
                
                if not details['aspect_ratio_match']:
                    passed = False
                    details['aspect_ratio_error'] = f"Aspect ratio mismatch: expected {expected_ratio:.2f}, got {actual_ratio:.2f}"
            
            # Check file size
            file_size = len(image_data)
            min_size = self.config.get('validation.min_file_size', 10240)
            max_size = self.config.get('validation.max_file_size', 10485760)
            
            details['file_size'] = file_size
            details['file_size_kb'] = f"{file_size / 1024:.2f} KB"
            details['file_size_valid'] = min_size <= file_size <= max_size
            
            if not details['file_size_valid']:
                passed = False
                details['file_size_error'] = f"File size out of range: {file_size} bytes"
            
            # Check format
            details['format'] = image.format
            details['mode'] = image.mode
            
            # Overall validation
            details['validation_passed'] = passed
            
            self.logger.log_validation(filename, passed, details)
            
            return passed, details
            
        except Exception as e:
            error_details = {
                'error': str(e),
                'validation_passed': False
            }
            self.logger.log_validation(filename, False, error_details)
            return False, error_details
    
    def validate_batch(self, images: list, category: str, base_filename: str) -> Dict[str, Any]:
        """Validate a batch of images
        
        Args:
            images: List of image bytes
            category: Image category
            base_filename: Base filename for images
            
        Returns:
            Dictionary with validation summary
        """
        results = []
        passed_count = 0
        
        for i, image_data in enumerate(images):
            filename = f"{base_filename}_{i+1}"
            passed, details = self.validate_image(image_data, category, filename)
            
            results.append({
                'filename': filename,
                'passed': passed,
                'details': details
            })
            
            if passed:
                passed_count += 1
        
        summary = {
            'total': len(images),
            'passed': passed_count,
            'failed': len(images) - passed_count,
            'success_rate': f"{(passed_count / len(images) * 100):.1f}%",
            'results': results
        }
        
        return summary
