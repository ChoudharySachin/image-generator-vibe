"""Generator Controller - Main orchestration for image generation"""
from datetime import datetime
from pathlib import Path
import json
from typing import Dict, Any, List, Optional, Callable

from config_manager import ConfigManager
from logger import ImageGeneratorLogger
from gemini_client import GeminiClient
from prompt_builder import PromptBuilder
from validator import ImageValidator

class GeneratorController:
    """Main controller for image generation workflow"""
    
    def __init__(self, config_dir: str = None):
        """Initialize generator controller
        
        Args:
            config_dir: Path to configuration directory
        """
        # Initialize components
        self.config = ConfigManager(config_dir)
        self.logger = ImageGeneratorLogger(self.config)
        self.gemini_client = GeminiClient(self.config, self.logger)
        self.prompt_builder = PromptBuilder(self.config, self.logger)
        self.validator = ImageValidator(self.config, self.logger)
        
        self.logger.info("Generator Controller initialized")
    
    def generate(
        self,
        category: str,
        user_input: str,
        count: int = None,
        progress_callback: Optional[Callable] = None,
        selected_models: List[str] = None,
        on_image_generated: Optional[Callable] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate images for a category
        
        Args:
            category: Image category
            user_input: User's input (subtopic, context, activity, etc.)
            count: Number of images to generate (default from config)
            progress_callback: Optional callback(current, total, status)
            selected_models: List of selected models ['flash', 'pro']
            on_image_generated: Optional callback(index, image_info)
            **kwargs: Additional parameters for prompt building
            
        Returns:
            Dictionary with generation results
        """
        if count is None:
            count = self.config.get('generation.images_per_prompt', 4)
        
        # Define model IDs
        MODEL_FLASH = "google/gemini-2.5-flash-image-preview"
        MODEL_PRO = "google/gemini-3-pro-image-preview"
        
        # Determine model distribution
        models_to_use = []
        
        if not selected_models:
            # Default to all Flash if none selected
            models_to_use = [MODEL_FLASH] * count
        elif 'flash' in selected_models and 'pro' not in selected_models:
            # Only Flash selected
            models_to_use = [MODEL_FLASH] * count
        elif 'pro' in selected_models and 'flash' not in selected_models:
            # Only Pro selected
            models_to_use = [MODEL_PRO] * count
        else:
            # Both selected - distribute based on count
            if count == 1:
                models_to_use = [MODEL_FLASH]
            elif count == 2:
                models_to_use = [MODEL_FLASH, MODEL_PRO]
            elif count == 3:
                models_to_use = [MODEL_FLASH, MODEL_FLASH, MODEL_PRO]
            elif count == 4:
                models_to_use = [MODEL_FLASH, MODEL_FLASH, MODEL_PRO, MODEL_PRO]
            else:
                # Fallback for other counts: alternate
                models_to_use = []
                for i in range(count):
                    models_to_use.append(MODEL_FLASH if i % 2 == 0 else MODEL_PRO)
        
        # Start generation
        self.logger.log_generation_start(category, user_input, count)
        
        if progress_callback:
            progress_callback(0, count + 2, "Building prompt...")
        
        # Build prompt
        try:
            prompt = self.prompt_builder.build_prompt(category, user_input, **kwargs)
            self.logger.info(f"Prompt built successfully ({len(prompt)} characters)")
        except Exception as e:
            self.logger.error(f"Failed to build prompt: {str(e)}")
            return {
                'success': False,
                'error': f"Prompt building failed: {str(e)}"
            }
        
        if progress_callback:
            progress_callback(1, count + 2, "Generating images...")
            
        # Base filename for saving images
        base_filename = self._generate_base_filename(category, user_input)
        output_dir = self.config.get_output_dir()
        
        # Callback wrapper to save image and notify
        def handle_generated_image(index, image_data):
            # Save the image immediately
            saved_info = self._save_single_image(image_data, output_dir, base_filename, index)
            
            # Notify caller
            if on_image_generated and saved_info['success']:
                on_image_generated(index, saved_info)
        
        # Generate images
        images = self.gemini_client.generate_multiple_images(
            prompt,
            count,
            category=category,
            progress_callback=lambda curr, total, status: progress_callback(curr + 1, count + 2, status) if progress_callback else None,
            models=models_to_use,
            on_image_generated=handle_generated_image
        )
        
        if progress_callback:
            progress_callback(count + 1, count + 2, "Validating and saving...")
        
        # Re-construct saved_images list from the already saved files (or save failed ones)
        saved_images = []
        for i, img_data in enumerate(images):
            saved_images.append(self._save_single_image(img_data, output_dir, base_filename, i))
        
        # Validate
        validation_summary = self.validator.validate_batch(
            [img for img in images if img is not None],
            category,
            base_filename
        )
        
        # Log completion
        success_count = len([img for img in images if img is not None])
        self.logger.log_generation_complete(category, success_count, count)
        
        if progress_callback:
            progress_callback(count + 2, count + 2, "Complete!")
        
        # Prepare result
        result = {
            'success': success_count > 0,
            'category': category,
            'user_input': user_input,
            'prompt': prompt,
            'total_requested': count,
            'total_generated': success_count,
            'images': saved_images,
            'validation': validation_summary,
            'session_id': self.logger.session_id,
            'timestamp': datetime.now().isoformat(),
            'models_used': models_to_use
        }
        
        # Save session metadata
        self._save_session_metadata(result)
        
        return result
    
    def _generate_base_filename(self, category: str, user_input: str) -> str:
        """Generate base filename for images
        
        Args:
            category: Image category
            user_input: User input
            
        Returns:
            Base filename
        """
        # Sanitize user input for filename
        safe_input = "".join(c for c in user_input if c.isalnum() or c in (' ', '-', '_'))
        safe_input = safe_input.replace(' ', '_')[:30]  # Limit length
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        return f"{category}_{safe_input}_{timestamp}"
    
    def _save_single_image(self, image_data: Optional[bytes], output_dir: Path, base_filename: str, index: int) -> Dict[str, Any]:
        """Save a single image to disk
        
        Args:
            image_data: Image bytes
            output_dir: Output directory path
            base_filename: Base filename
            index: Image index (0-based)
            
        Returns:
            Saved image info
        """
        if image_data is None:
            return {
                'index': index + 1,
                'success': False,
                'error': 'Generation failed'
            }
        
        filename = f"{base_filename}_{index+1}.png"
        filepath = output_dir / filename
        
        try:
            # Check if already exists (might be saved by callback)
            if not filepath.exists():
                with open(filepath, 'wb') as f:
                    f.write(image_data)
                self.logger.info(f"Saved image: {filename}")
            
            return {
                'index': index + 1,
                'success': True,
                'filename': filename,
                'filepath': str(filepath),
                'size_bytes': len(image_data)
            }
            
        except Exception as e:
            self.logger.error(f"Failed to save image {index+1}: {str(e)}")
            return {
                'index': index + 1,
                'success': False,
                'error': str(e)
            }

    def _save_images(self, images: List[Optional[bytes]], category: str, user_input: str) -> List[Dict[str, Any]]:
        """Save generated images to disk (Legacy wrapper)"""
        output_dir = self.config.get_output_dir()
        base_filename = self._generate_base_filename(category, user_input)
        
        saved_images = []
        for i, img_data in enumerate(images):
            saved_images.append(self._save_single_image(img_data, output_dir, base_filename, i))
            
        return saved_images
    
    def _save_session_metadata(self, result: Dict[str, Any]):
        """Save session metadata to JSON file
        
        Args:
            result: Generation result dictionary
        """
        if not self.config.get('output.save_metadata', True):
            return
        
        output_dir = self.config.get_output_dir()
        metadata_file = output_dir / f"session_{result['session_id']}.json"
        
        try:
            with open(metadata_file, 'w') as f:
                json.dump(result, f, indent=2)
            
            self.logger.debug(f"Saved session metadata: {metadata_file}")
        except Exception as e:
            self.logger.error(f"Failed to save session metadata: {str(e)}")
    
    def refine_image(
        self,
        category: str,
        base_image_path: str,
        refinement_instructions: str,
        progress_callback: Optional[Callable] = None,
        on_image_generated: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """Refine an existing image
        
        Args:
            category: Image category
            base_image_path: Path to base image
            refinement_instructions: Instructions for refinement
            progress_callback: Optional callback
            on_image_generated: Optional callback(index, image_info)
            
        Returns:
            Dictionary with refinement results
        """
        self.logger.info(f"Refining image {base_image_path} with instructions: {refinement_instructions}")
        
        if progress_callback:
            progress_callback(0, 3, "Processing request...")
            
        # Refine image
        if progress_callback:
            progress_callback(1, 3, "Generating refined image...")
            
        image_data = self.gemini_client.refine_image(
            base_image_path,
            refinement_instructions,
            category
        )
        
        if progress_callback:
            progress_callback(2, 3, "Saving result...")
            
        # Save image
        output_dir = self.config.get_output_dir()
        # Use a distinct prefix for refined images or keep similar naming?
        # Let's use "refined" prefix + timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_filename = f"refined_{category}_{timestamp}"
        
        saved_info = self._save_single_image(image_data, output_dir, base_filename, 0)
        saved_images = [saved_info]
        
        # Notify callback
        if on_image_generated and saved_info['success']:
            try:
                on_image_generated(0, saved_info)
            except Exception as e:
                self.logger.error(f"Error in on_image_generated callback: {str(e)}")
        
        # Validate
        validation_summary = self.validator.validate_batch(
            [image_data] if image_data else [],
            category,
            "refinement"
        )
        
        success = image_data is not None
        
        if progress_callback:
            progress_callback(3, 3, "Complete!")
            
        # Prepare result
        result = {
            'success': success,
            'category': category,
            'user_input': refinement_instructions,
            'prompt': f"Refinement: {refinement_instructions}",
            'total_requested': 1,
            'total_generated': 1 if success else 0,
            'images': saved_images,
            'validation': validation_summary,
            'session_id': self.logger.session_id,
            'timestamp': datetime.now().isoformat()
        }
        
        # Save session metadata
        self._save_session_metadata(result)
        
        return result

    def get_categories(self) -> Dict[str, Dict[str, Any]]:
        """Get all available categories
        
        Returns:
            Dictionary of categories with their configurations
        """
        return self.config.get_all_categories()
