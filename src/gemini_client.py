"""Gemini API Client for image generation via OpenRouter"""
import time
import requests
import base64
from typing import Optional
from pathlib import Path
import os
from PIL import Image
from io import BytesIO

class GeminiClient:
    """Client for interacting with Gemini API via OpenRouter for image generation"""
    
    def __init__(self, config_manager, logger):
        """Initialize Gemini client
        
        Args:
            config_manager: ConfigManager instance
            logger: ImageGeneratorLogger instance
        """
        self.config = config_manager
        self.logger = logger
        
        # Get API key
        self.api_key = self.config.get_api_key()
        
        # OpenRouter API endpoint
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"
        
        # Model name - Gemini 2.5 Flash Image Preview
        self.model_name = "google/gemini-2.5-flash-image"
        
        self.logger.info(f"Gemini client initialized with OpenRouter API")
    
    def _correct_aspect_ratio(self, image_data: bytes, target_width: int, target_height: int) -> bytes:
        """Correct image aspect ratio by resizing and cropping
        
        Args:
            image_data: Original image bytes
            target_width: Target width in pixels
            target_height: Target height in pixels
            
        Returns:
            Corrected image bytes
        """
        try:
            # Open image
            img = Image.open(BytesIO(image_data))
            original_size = img.size
            
            # Calculate target aspect ratio
            if target_height <= 0 or img.height <= 0:
                self.logger.warning(f"Invalid dimensions: target_h={target_height}, img_h={img.height}. Skipping AR correction.")
                return image_data
                
            target_ratio = target_width / target_height
            current_ratio = img.width / img.height
            
            self.logger.info(f"Aspect ratio correction: Original {img.width}x{img.height} (ratio {current_ratio:.3f}) -> Target {target_width}x{target_height} (ratio {target_ratio:.3f})")
            
            # If dimensions match exactly, skip processing
            if img.width == target_width and img.height == target_height:
                self.logger.info(f"✓ Image already in target dimensions {target_width}x{target_height}. No resizing needed.")
                return image_data

            # If aspect ratio is already very close (within 1% tolerance), just resize
            ratio_diff = abs(current_ratio - target_ratio) / target_ratio
            if ratio_diff < 0.01:
                self.logger.info(f"Aspect ratio close enough ({ratio_diff*100:.1f}% difference), resizing to exact dimensions")
                img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
            else:
                # If mismatch is large, we should NOT crop as it removes content.
                # Instead, we will resize to the target dimensions. 
                # Ideally the API should have returned the right aspect ratio.
                self.logger.warning(f"Aspect ratio mismatch ({ratio_diff*100:.1f}% difference). RESIZING ONLY to preserve all content.")
                img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
            
            # Convert back to bytes
            output = BytesIO()
            img.save(output, format='PNG')
            corrected_data = output.getvalue()
            
            final_img = Image.open(BytesIO(corrected_data))
            self.logger.info(f"✓ Final image size: {final_img.width}x{final_img.height}")
            
            return corrected_data
            
        except Exception as e:
            self.logger.error(f"Failed to correct aspect ratio: {str(e)}")
            import traceback
            self.logger.error(traceback.format_exc())
            # Return original if correction fails
            return image_data
    
    def _image_to_data_url(self, image_path: Path) -> str:
        """Convert image file to base64 data URL
        
        Args:
            image_path: Path to image file
            
        Returns:
            Base64 data URL string
        """
        with open(image_path, 'rb') as f:
            image_data = f.read()
        
        # Detect mime type from extension
        ext = image_path.suffix.lower()
        mime_types = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        }
        mime_type = mime_types.get(ext, 'image/png')
        
        # Convert to base64
        base64_data = base64.b64encode(image_data).decode('utf-8')
        data_url = f"data:{mime_type};base64,{base64_data}"
        
        return data_url
    
    def _get_reference_images(self, category: str) -> list:
        """Get reference images for a category
        
        Args:
            category: Image category
            
        Returns:
            List of data URLs for reference images
        """
        ref_dir = self.config.get_reference_dir(category)
        
        if not ref_dir.exists():
            self.logger.warning(f"Reference directory not found: {ref_dir}")
            return []
        
        # Get all image files
        image_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
        image_files = []
        
        for ext in image_extensions:
            image_files.extend(ref_dir.glob(f'*{ext}'))
        
        if not image_files:
            self.logger.warning(f"No reference images found in: {ref_dir}")
            return []
        
        # Convert to data URLs
        data_urls = []
        for img_path in image_files[:2]:  # Limit to 2 reference images
            try:
                data_url = self._image_to_data_url(img_path)
                data_urls.append(data_url)
                self.logger.debug(f"Loaded reference image: {img_path.name}")
            except Exception as e:
                self.logger.warning(f"Failed to load reference image {img_path}: {str(e)}")
        
        self.logger.info(f"Loaded {len(data_urls)} reference images for category '{category}'")
        return data_urls
    
    def _get_api_key(self, provided_key: str = None) -> str:
        """Get the effective API key to use
        
        Args:
            provided_key: Key provided in the request
            
        Returns:
            Key to use
        """
        if provided_key and provided_key.strip():
            return provided_key.strip()
        return self.api_key

    def generate_image(self, prompt: str, category: str = None, retry_count: int = 0, model: str = None, use_references: bool = True, target_width: int = None, target_height: int = None, user_reference_images: list = None, api_key: str = None) -> Optional[bytes]:
        """Generate a single image from prompt
        
        Args:
            prompt: Text prompt for image generation
            category: Image category (for loading reference images)
            retry_count: Current retry attempt number
            model: Model to use (default: self.model_name)
            use_references: Whether to include system reference images (default: True)
            target_width: Target width in pixels
            target_height: Target height in pixels
            user_reference_images: List of data URLs for user-provided reference images
            
        Returns:
            Image bytes if successful, None otherwise
        """
        max_retries = self.config.get('api.max_retries', 3)
        timeout = self.config.get('api.timeout', 120)
        
        # Use specified model or default
        current_model = model if model else self.model_name
        
        # Check dry-run mode
        if self.config.is_dry_run():
            self.logger.info(f"DRY RUN: Skipping actual API call ({current_model})")
            self.logger.debug(f"Would have sent prompt: {prompt[:100]}...")
            return None
        
        try:
            start_time = time.time()
            
            self.logger.debug(f"Sending prompt to OpenRouter API ({current_model}, attempt {retry_count + 1}/{max_retries + 1})")
            
            # Get system reference images if category provided AND enabled
            system_reference_images = []
            if category and use_references:
                system_reference_images = self._get_reference_images(category)
            
            # Combine system and user reference images
            all_reference_images = system_reference_images + (user_reference_images or [])
            
            # Build content array with reference images and text
            # CRITICAL: Make it very clear the model must COPY the character design
            if all_reference_images:
                full_prompt = f"""CRITICAL INSTRUCTIONS: 
"""
                if system_reference_images:
                    full_prompt += """
1. CHARACTER DESIGN: The provided system images show the EXACT character design you MUST use.
   - COPY the character's appearance EXACTLY from these reference images
   - EXACT same body shape, proportions, colors, facial features, and design details
   - DO NOT create a new character or modify the design
"""
                
                if user_reference_images:
                    full_prompt += """
2. USER REFERENCES: The provided user images are for additional context or style inspiration as requested in the prompt.
"""
                
                full_prompt += f"""
3. RESOLUTION & ASPECT RATIO: The image MUST be generated in EXACTLY {target_width}x{target_height} resolution.
   - This is NON-NEGOTIABLE
   - The composition MUST be optimized for this {target_width}x{target_height} frame
   - Do NOT use a square frame and crop it; generate the full {target_width}x{target_height} scene

Now generate an image based on this request: "{prompt}"

Remember: 
- Character design is FIXED (shown in reference images)
- Size is FIXED at {target_width}x{target_height}
- Only the scene/context should be new"""
            else:
                full_prompt = f"Generate an image in EXACTLY {target_width}x{target_height} resolution based on the following request: \"{prompt}\". The scene must be fully composed for this aspect ratio."
            
            content = []
            
            # Add all reference images first
            for data_url in all_reference_images:
                content.append({
                    "type": "image_url",
                    "image_url": {"url": data_url}
                })
            
            # Add text prompt
            content.append({
                "type": "text",
                "text": full_prompt
            })
            
            # Prepare request
            effective_key = self._get_api_key(api_key)
            if not effective_key:
                raise ValueError("No API key found. Enter a valid API Key")

            headers = {
                "Authorization": f"Bearer {effective_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:8080",
                "X-Title": "Educational Image Generator"
            }
            
            # Determine best aspect ratio and dimensions for payload
            target_ratio = target_width / target_height if target_width and target_height else 1.0
            ar_param = "1:1"
            if target_ratio > 1.3: ar_param = "16:9"
            elif 1.1 < target_ratio <= 1.3: ar_param = "4:3"
            elif 0.8 <= target_ratio <= 1.1: ar_param = "1:1"
            elif 0.7 <= target_ratio < 0.8: ar_param = "3:4"
            elif 0.6 <= target_ratio < 0.7: ar_param = "2:3"
            elif target_ratio < 0.6: ar_param = "9:16"
            
            self.logger.info(f"Requesting original image at {target_width}x{target_height} (AR: {ar_param})")

            payload = {
                "model": current_model,
                "messages": [
                    {
                        "role": "user",
                        "content": content
                    }
                ],
                "modalities": ["image", "text"],
                "image_config": {
                    "aspect_ratio": ar_param,
                    "width": target_width,
                    "height": target_height
                }
            }
            
            self.logger.debug(f"Request payload: {len(all_reference_images)} total reference images, prompt length: {len(prompt)}")
            
            response = requests.post(
                self.api_url,
                headers=headers,
                json=payload,
                timeout=timeout
            )
            
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                
                # Extract the generated image
                message = data.get('choices', [{}])[0].get('message', {})
                images = message.get('images', [])
                
                if images and len(images) > 0:
                    image_url = images[0].get('image_url', {}).get('url')
                    
                    if image_url:
                        # Download the generated image
                        if image_url.startswith('data:'):
                            # It's a data URL, extract base64 data
                            base64_data = image_url.split(',')[1]
                            image_data = base64.b64decode(base64_data)
                        else:
                            # It's a regular URL, download it
                            img_response = requests.get(image_url, timeout=30)
                            if img_response.status_code == 200:
                                image_data = img_response.content
                            else:
                                self.logger.error(f"Failed to download generated image: {img_response.status_code}")
                                return None
                        
                        self.logger.log_api_call(prompt, response_time, True)
                        self.logger.info(f"Image generated successfully in {response_time:.2f}s using {current_model}")
                        
                        # Apply aspect ratio correction
                        t_width = target_width
                        t_height = target_height
                        
                        # Fallback to category config if not provided
                        if (t_width is None or t_height is None) and category:
                            category_config = self.config.get_category(category)
                            t_width = category_config['width']
                            t_height = category_config['height']
                        
                        if t_width and t_height:
                            image_data = self._correct_aspect_ratio(image_data, t_width, t_height)
                        
                        return image_data
                
                self.logger.warning("No image found in API response")
                self.logger.debug(f"Response data: {data}")
                self.logger.log_api_call(prompt, response_time, False)
            else:
                error_text = response.text
                if response.status_code == 401:
                    raise ValueError("Wrong API Key. Enter a valid API Key")
                self.logger.error(f"API request failed with status {response.status_code}: {error_text}")
                self.logger.log_api_call(prompt, response_time, False)
            
            # Retry if attempts remaining
            if retry_count < max_retries:
                retry_delay = self.config.get('api.retry_delay', 2)
                self.logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                return self.generate_image(prompt, category, retry_count + 1, model, use_references, target_width, target_height, user_reference_images, api_key=api_key)
            
            return None
            
        except Exception as e:
            error_msg = str(e)
            # If it's one of our specific error messages, don't retry, just bubble it up
            if error_msg in ["No API key found. Enter a valid API Key", "Wrong API Key. Enter a valid API Key"]:
                self.logger.error(f"Critical API Error: {error_msg}")
                raise e

            response_time = time.time() - start_time if 'start_time' in locals() else 0
            self.logger.error(f"API call failed: {str(e)}")
            self.logger.log_api_call(prompt, response_time, False)
            
            # Retry if attempts remaining
            if retry_count < max_retries:
                retry_delay = self.config.get('api.retry_delay', 2)
                self.logger.warning(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                return self.generate_image(prompt, category, retry_count + 1, model, use_references, target_width, target_height, user_reference_images, api_key=api_key)
            
            return None
    
    def generate_multiple_images(self, prompt: str, count: int = 4, category: str = None, progress_callback=None, models: list = None, on_image_generated=None) -> list:
        """Generate multiple images from the same prompt with style variations
        
        Args:
            prompt: Text prompt for image generation
            count: Number of images to generate
            category: Image category (for loading reference images)
            progress_callback: Optional callback function(current, total, status)
            models: List of models to use for each image (must match count length if provided)
            on_image_generated: Optional callback(index, image_data) called after each image
            
        Returns:
            List of image bytes (may contain None for failed generations)
        """
        images = []
        
        self.logger.info(f"Generating {count} images from prompt")
        
        for i in range(count):
            # Determine model for this image
            current_model = models[i] if models and i < len(models) else self.model_name
            
            if progress_callback:
                progress_callback(i + 1, count, f"Generating image {i + 1}/{count} using {current_model.split('/')[-1]}...")
            
            self.logger.info(f"Generating image {i + 1}/{count} with {current_model}")
            
            # Use the prompt exactly as provided by the prompt builder
            current_prompt = prompt
            
            image_data = self.generate_image(current_prompt, category, model=current_model)
            images.append(image_data)
            
            # Notify callback if image generated successfully
            if image_data and on_image_generated:
                try:
                    on_image_generated(i, image_data)
                except Exception as e:
                    self.logger.error(f"Error in on_image_generated callback: {str(e)}")
            
            # Small delay between requests to avoid rate limiting
            if i < count - 1:
                time.sleep(1)
        
        successful = sum(1 for img in images if img is not None)
        self.logger.info(f"Generated {successful}/{count} images successfully")
        
        return images

    def refine_image(self, base_image_path: str, instructions: str, category: str = None, retry_count: int = 0, api_key: str = None) -> Optional[bytes]:
        """Refine an existing image based on instructions
        
        Args:
            base_image_path: Path to the base image to refine
            instructions: Refinement instructions
            category: Image category (for loading reference images)
            retry_count: Current retry attempt number
            
        Returns:
            Image bytes if successful, None otherwise
        """
        max_retries = self.config.get('api.max_retries', 3)
        timeout = self.config.get('api.timeout', 120)
        
        # Check dry-run mode
        if self.config.is_dry_run():
            self.logger.info("DRY RUN: Skipping actual API call")
            return None
        
        try:
            start_time = time.time()
            self.logger.debug(f"Refining image with instructions: {instructions}")
            
            # Load base image
            if str(base_image_path).startswith(('http://', 'https://')):
                self.logger.info(f"Using remote URL for base image: {base_image_path}")
                base_image_url = base_image_path
            else:
                base_image_url = self._image_to_data_url(Path(base_image_path))
            
            # Get reference images if category provided
            reference_images = []
            if category:
                reference_images = self._get_reference_images(category)
            
            # Build content array
            content = []
            
            # Add reference images first (style guides)
            for data_url in reference_images:
                content.append({
                    "type": "image_url",
                    "image_url": {"url": data_url}
                })
            
            # Add base image to be refined
            content.append({
                "type": "image_url",
                "image_url": {"url": base_image_url}
            })
            
            # Add text prompt with strong character consistency instruction
            if reference_images:
                full_prompt = f"""CRITICAL INSTRUCTION: The first images show the EXACT character design you MUST use. The last image is the base image to refine.

You must COPY the character's appearance EXACTLY from the reference images:
- EXACT same body shape and proportions
- EXACT same colors (as shown in reference images)
- EXACT same facial features (as shown in reference images)
- EXACT same design details (as shown in reference images)

Now refine the base image (last image) according to these instructions: "{instructions}"

CRITICAL: 
- Keep the character design EXACTLY as shown in the reference images
- Maintain the EXACT aspect ratio and dimensions of the original image
- Only modify the scene/context as requested"""
            else:
                full_prompt = f"Refine the provided image according to these instructions: \"{instructions}\". Maintain the same style, quality, and aspect ratio."
            
            content.append({
                "type": "text",
                "text": full_prompt
            })
            
            # Prepare request
            effective_key = self._get_api_key(api_key)
            if not effective_key:
                raise ValueError("No API key found. Enter a valid API Key")

            headers = {
                "Authorization": f"Bearer {effective_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:8080",
                "X-Title": "Educational Image Generator"
            }
            
            payload = {
                "model": self.model_name,
                "messages": [
                    {
                        "role": "user",
                        "content": content
                    }
                ],
                "modalities": ["image", "text"]
            }
            
            response = requests.post(
                self.api_url,
                headers=headers,
                json=payload,
                timeout=timeout
            )
            
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                
                # Extract the generated image
                message = data.get('choices', [{}])[0].get('message', {})
                images = message.get('images', [])
                
                if images and len(images) > 0:
                    image_url = images[0].get('image_url', {}).get('url')
                    
                    if image_url:
                        # Download the generated image
                        if image_url.startswith('data:'):
                            base64_data = image_url.split(',')[1]
                            image_data = base64.b64decode(base64_data)
                        else:
                            img_response = requests.get(image_url, timeout=30)
                            if img_response.status_code == 200:
                                image_data = img_response.content
                            else:
                                self.logger.error(f"Failed to download refined image: {img_response.status_code}")
                                return None
                        
                        self.logger.log_api_call(instructions, response_time, True)
                        return image_data
            
            error_text = response.text
            if response.status_code == 401:
                raise ValueError("Wrong API Key. Enter a valid API Key")
            self.logger.error(f"Refinement failed with status {response.status_code}: {error_text}")
            
            # Retry if attempts remaining
            if retry_count < max_retries:
                retry_delay = self.config.get('api.retry_delay', 2)
                self.logger.info(f"Retrying refinement in {retry_delay} seconds...")
                time.sleep(retry_delay)
                return self.refine_image(base_image_path, instructions, category, retry_count + 1, api_key=api_key)
                
            return None
            
        except Exception as e:
            error_msg = str(e)
            if error_msg in ["No API key found. Enter a valid API Key", "Wrong API Key. Enter a valid API Key"]:
                self.logger.error(f"Critical API Error during refinement: {error_msg}")
                raise e

            self.logger.error(f"Refinement exception: {str(e)}")
            
            # Retry if attempts remaining
            if retry_count < max_retries:
                retry_delay = self.config.get('api.retry_delay', 2)
                self.logger.warning(f"Retrying refinement after exception in {retry_delay} seconds...")
                time.sleep(retry_delay)
                return self.refine_image(base_image_path, instructions, category, retry_count + 1, api_key=api_key)
            
            return None
