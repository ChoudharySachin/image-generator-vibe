"""Generator Controller - Main orchestration for image generation"""
from datetime import datetime
from pathlib import Path
import json
from typing import Dict, Any, List, Optional, Callable
import time
import random

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
    
    def _detect_style_from_input(self, user_input: str) -> str:
        """Detect if user specified a style in their input
        
        Args:
            user_input: User's input text
            
        Returns:
            Style ID if detected, None otherwise
        """
        user_input_lower = user_input.lower()
        
        # Style detection keywords
        style_keywords = {
            'glossy_3d': ['glossy', 'glass', 'translucent', 'transparent'],
            'watercolor': ['watercolor', 'watercolour', 'painted', 'artistic'],
            'hand_drawn_chalk': ['chalk', 'chalkboard', 'blackboard', 'hand-drawn', 'hand drawn'],
            'paper_craft': ['paper', 'papercraft', 'paper-craft', 'cardboard', 'layered'],
            'flat_3d': ['flat', 'matte'],
            'minimal_clean_3d': ['minimal', 'clean', 'simple'],
            'holographic': ['holographic', 'holo', 'iridescent', 'rainbow', 'prismatic']
        }
        
        for style_id, keywords in style_keywords.items():
            for keyword in keywords:
                if keyword in user_input_lower:
                    self.logger.info(f"Detected style '{style_id}' from keyword '{keyword}'")
                    return style_id
        
        return None
    
    def _select_styles_for_generation(self, category: str, count: int, user_input: str, specified_style: str = None) -> list:
        """Select styles for image generation based on subtopic and year level
        
        Args:
            category: Image category
            count: Number of images to generate
            user_input: User's input text
            specified_style: Style specified by user (if any)
            
        Returns:
            List of style IDs to use for each image
        """
        # Only apply to subtopic_cover category
        if category != 'subtopic_cover':
            return [None] * count
        
        # Get available styles from config
        category_config = self.config.get_category(category)
        styles = category_config.get('styles', [])
        available_style_ids = [s['id'] for s in styles if s['id'] != 'original']
        
        if not available_style_ids:
            return [None] * count
        
        # Check if user specified a style in their input
        detected_style = self._detect_style_from_input(user_input)
        
        # If style was specified (either explicitly or detected), use it for all images
        if specified_style and specified_style != 'original':
            self.logger.info(f"Using specified style '{specified_style}' for all {count} images")
            return [specified_style] * count
        elif detected_style:
            self.logger.info(f"Using detected style '{detected_style}' for all {count} images")
            return [detected_style] * count
        
        # Intelligent style selection based on subtopic and year level
        selected_styles = self._select_appropriate_styles(user_input, count, available_style_ids)
        
        self.logger.info(f"Intelligently selected styles for {count} images: {selected_styles}")
        return selected_styles
    
    def _select_appropriate_styles(self, user_input: str, count: int, available_styles: list) -> list:
        """Select appropriate styles based on subtopic characteristics and year level
        
        Args:
            user_input: User's input containing subtopic and year level
            count: Number of styles to select
            available_styles: List of available style IDs
            
        Returns:
            List of selected style IDs
        """
        user_input_lower = user_input.lower()
        
        # Extract year level (if mentioned)
        year_level = 8  # default
        import re
        year_match = re.search(r'year\s+(\d+)', user_input_lower)
        if year_match:
            year_level = int(year_match.group(1))
        
        # Define style preferences based on characteristics
        style_preferences = {
            'young_friendly': ['watercolor', 'paper_craft', 'flat_3d'],  # Years 1-6
            'middle_balanced': ['minimal_clean_3d', 'flat_3d', 'paper_craft', 'watercolor'],  # Years 7-9
            'advanced_sophisticated': ['glossy_3d', 'holographic', 'minimal_clean_3d'],  # Years 10+
            
            'geometric_precise': ['minimal_clean_3d', 'glossy_3d', 'flat_3d'],  # Geometry, shapes, angles
            'algebraic_clean': ['minimal_clean_3d', 'hand_drawn_chalk', 'flat_3d'],  # Algebra, equations
            'data_visual': ['flat_3d', 'paper_craft', 'minimal_clean_3d'],  # Graphs, data, statistics
            'abstract_artistic': ['watercolor', 'holographic', 'glossy_3d'],  # Probability, patterns
        }
        
        # Determine topic category
        geometric_keywords = ['shape', 'angle', 'triangle', 'circle', 'polygon', 'geometry', 'area', 'perimeter', 'volume', 'bearing']
        algebraic_keywords = ['algebra', 'equation', 'expression', 'variable', 'solve', 'linear', 'quadratic']
        data_keywords = ['graph', 'data', 'statistics', 'chart', 'plot', 'mean', 'median', 'mode']
        abstract_keywords = ['probability', 'pattern', 'sequence', 'ratio', 'proportion', 'fraction']
        
        # Select appropriate style pool
        if year_level <= 6:
            style_pool = style_preferences['young_friendly']
        elif year_level <= 9:
            style_pool = style_preferences['middle_balanced']
        else:
            style_pool = style_preferences['advanced_sophisticated']
        
        # Refine based on topic type
        if any(keyword in user_input_lower for keyword in geometric_keywords):
            style_pool = [s for s in style_preferences['geometric_precise'] if s in available_styles]
        elif any(keyword in user_input_lower for keyword in algebraic_keywords):
            style_pool = [s for s in style_preferences['algebraic_clean'] if s in available_styles]
        elif any(keyword in user_input_lower for keyword in data_keywords):
            style_pool = [s for s in style_preferences['data_visual'] if s in available_styles]
        elif any(keyword in user_input_lower for keyword in abstract_keywords):
            style_pool = [s for s in style_preferences['abstract_artistic'] if s in available_styles]
        
        # Filter to only available styles
        style_pool = [s for s in style_pool if s in available_styles]
        
        # If pool is empty, use all available styles
        if not style_pool:
            style_pool = available_styles
        
        # Select different styles from the pool
        if count <= len(style_pool):
            selected = random.sample(style_pool, count)
        else:
            # Need more styles than available in pool, use all pool + random from available
            selected = style_pool.copy()
            remaining = count - len(selected)
            selected.extend(random.choices(available_styles, k=remaining))
        
        return selected
    
    def generate(
        self,
        category: str,
        user_input: str,
        count: int = None,
        progress_callback: Optional[Callable] = None,
        selected_models: List[str] = None,
        on_image_generated: Optional[Callable] = None,
        orientation: str = None,
        user_reference_images: List[str] = None,
        api_key: str = None,
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
            orientation: Requested orientation ('landscape' or 'portrait')
            user_reference_images: List of data URLs for user-provided reference images
            **kwargs: Additional parameters for prompt building
            
        Returns:
            Dictionary with generation results
        """
        if count is None:
            count = self.config.get('generation.images_per_prompt', 4)
        
        # Override dimensions based on orientation if provided
        target_width = None
        target_height = None
        target_aspect_ratio = None
        
        if orientation == 'landscape':
            target_width = 1920
            target_height = 1080
            target_aspect_ratio = "16:9"
            self.logger.info(f"Target orientation set to LANDSCAPE: {target_width}x{target_height}")
        elif orientation == 'portrait':
            target_width = 1060
            target_height = 1500
            target_aspect_ratio = "1060:1500"
            self.logger.info(f"Target orientation set to PORTRAIT: {target_width}x{target_height}")
        
        # Define model IDs
        MODEL_FLASH = "google/gemini-2.5-flash-image"
        MODEL_PRO = "google/gemini-3-pro-image-preview"
        
        # Determine model distribution
        # User reported issues with Pro model (3rd image), so defaulting to Flash for consistency
        # Flash has shown better adherence to reference images in this context
        models_to_use = [MODEL_FLASH] * count
        
        if selected_models:
             if 'pro' in selected_models and 'flash' not in selected_models:
                models_to_use = [MODEL_PRO] * count
             elif 'pro' in selected_models and 'flash' in selected_models:
                # If user explicitly asks for mixed, give it to them, but default is Flash
                models_to_use = []
                for i in range(count):
                    models_to_use.append(MODEL_FLASH if i % 2 == 0 else MODEL_PRO)
        
        # Start generation
        self.logger.log_generation_start(category, user_input, count)
        
        # Select styles for each image (for subtopic_cover category)
        specified_style = kwargs.get('style')
        selected_styles = self._select_styles_for_generation(category, count, user_input, specified_style)
        
        if progress_callback:
            progress_callback(0, count + 2, "Building prompt...")
        
        # Prompt building is now handled inside the generation loop to support variations
        
        if progress_callback:
            progress_callback(1, count + 2, "Generating images...")
            
        # Base filename for saving images
        base_filename = self._generate_base_filename(category, user_input)
        output_dir = self.config.get_output_dir()
        
        # Generate images one by one with individual styles/variations
        images = []
        saved_images = []
        
        # Store the first prompt as the "base" for metadata
        base_prompt = ""
        
        # Check for technical topics to suppress reference images (which cause distortion)
        technical_keywords = ['trigonometry', 'calculus', 'statistics', 'graph', 'geometry', 
                            'fraction', 'probability', 'algebra', 'equation', 'number', 
                            'math', 'arithmetic', 'experimental', 'naming',
                            'log', 'exponent', 'indices', 'power']
        
        # Only suppress references for subtopic_cover, allow for others if needed
        use_references = True
        if category == 'subtopic_cover' and any(k in user_input.lower() for k in technical_keywords):
             self.logger.info(f"Suppressing reference images for technical topic '{user_input}' to prevent style distortion.")
             use_references = False

        for i in range(count):
            # Get style for this image
            image_style = selected_styles[i] if i < len(selected_styles) else None
            
            # Prepare arguments for prompt builder
            current_kwargs = kwargs.copy()
            if image_style:
                current_kwargs['style'] = image_style
            
            # Add variation info
            current_kwargs['variation_index'] = i
            current_kwargs['total_variations'] = count
            
            # Add custom dimensions to prompt builder args
            if target_width and target_height:
                current_kwargs['width'] = target_width
                current_kwargs['height'] = target_height
                current_kwargs['aspect_ratio'] = target_aspect_ratio
            
            # Build prompt for this specific image
            try:
                image_prompt = self.prompt_builder.build_prompt(category, user_input, **current_kwargs)
                self.logger.info(f"Built prompt for image {i+1}/{count} (Style: {image_style})")
                
                # Capture the first prompt as the base prompt for metadata
                if i == 0:
                    base_prompt = image_prompt
                    
            except Exception as e:
                self.logger.error(f"Failed to build prompt for image {i+1}: {str(e)}")
                # If we can't build a prompt, we can't generate
                images.append(None)
                saved_images.append({'success': False, 'error': f"Prompt build failed: {str(e)}"})
                continue
            
            # Progress update
            if progress_callback:
                progress_callback(i + 1, count + 2, f"Generating image {i+1}/{count}...")
            
            # Generate single image
            try:
                model_to_use = models_to_use[i] if i < len(models_to_use) else models_to_use[0]
                image_data = self.gemini_client.generate_image(
                    image_prompt,
                    category=category,
                    model=model_to_use,
                    use_references=use_references,
                    target_width=target_width,
                    target_height=target_height,
                    user_reference_images=user_reference_images,
                    api_key=api_key
                )
                images.append(image_data)
                
                # Save immediately
                saved_info = self._save_single_image(image_data, output_dir, base_filename, i)
                saved_images.append(saved_info)
                
                # Notify caller
                if on_image_generated and saved_info['success']:
                    on_image_generated(i, saved_info)
                    
            except Exception as e:
                error_msg = str(e)
                if error_msg in ["No API key found. Enter a valid API Key", "Wrong API Key. Enter a valid API Key"]:
                    raise e
                self.logger.error(f"Failed to generate image {i+1}: {str(e)}")
                images.append(None)
                saved_images.append({'success': False, 'error': str(e)})
        
        
        if progress_callback:
            progress_callback(count + 1, count + 2, "Validating and saving...")
        
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
            'prompt': base_prompt,
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
        on_image_generated: Optional[Callable] = None,
        api_key: str = None
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
            
        try:
            image_data = self.gemini_client.refine_image(
                base_image_path,
                refinement_instructions,
                category,
                api_key=api_key
            )
        except Exception as e:
            error_msg = str(e)
            if error_msg in ["No API key found. Enter a valid API Key", "Wrong API Key. Enter a valid API Key"]:
                raise e
            self.logger.error(f"Failed to refine image: {str(e)}")
            image_data = None
        
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
