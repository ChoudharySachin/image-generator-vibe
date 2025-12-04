"""Prompt Builder for generating category-specific prompts"""
from pathlib import Path
from typing import Dict, Any, Optional

class PromptBuilder:
    """Builds prompts for image generation based on category and user input"""
    
    def __init__(self, config_manager, logger):
        """Initialize prompt builder
        
        Args:
            config_manager: ConfigManager instance
            logger: ImageGeneratorLogger instance
        """
        self.config = config_manager
        self.logger = logger
        self._style_guides = {}
        
    def _load_style_guide(self, category: str) -> str:
        """Load style guide for a category
        
        Args:
            category: Category name
            
        Returns:
            Style guide content
        """
        if category in self._style_guides:
            return self._style_guides[category]
        
        desc_file = self.config.get_description_file(category)
        
        if not desc_file.exists():
            self.logger.warning(f"Style guide not found for category: {category}")
            return ""
        
        with open(desc_file, 'r') as f:
            content = f.read()
        
        self._style_guides[category] = content
        return content
    
    def build_prompt(self, category: str, user_input: str, **kwargs) -> str:
        """Build a prompt for image generation
        
        Args:
            category: Image category
            user_input: User's input text (subtopic, context, activity, etc.)
            **kwargs: Additional parameters (year_level, age, etc.)
            
        Returns:
            Complete prompt for image generation
        """
        category_config = self.config.get_category(category)
        
        # Build prompt based on category
        if category == 'subtopic_cover':
            prompt = self._build_subtopic_prompt(user_input, category_config, **kwargs)
        elif category == 'tutero_ai':
            prompt = self._build_tutero_ai_prompt(user_input, category_config, **kwargs)
        elif category == 'classroom_activity':
            prompt = self._build_classroom_prompt(user_input, category_config, **kwargs)
        elif category == 'context_introduction':
            prompt = self._build_context_prompt(user_input, category_config, **kwargs)
        else:
            raise ValueError(f"Unknown category: {category}")
        
        self.logger.debug(f"Built prompt for category '{category}'", {
            'category': category,
            'user_input': user_input,
            'prompt_length': len(prompt)
        })
        
        return prompt
    
    def _build_subtopic_prompt(self, subtopic: str, config: Dict[str, Any], **kwargs) -> str:
        """Build prompt for subtopic cover image
        
        Args:
            subtopic: Subtopic name
            config: Category configuration
            **kwargs: Additional parameters (including 'style')
            
        Returns:
            Prompt string
        """
        year_level = kwargs.get('year_level', 'Year 8')
        style = kwargs.get('style', 'original')
        
        # Check if style templates are available
        styles = config.get('styles', [])
        style_template = None
        
        # Find the selected style template
        for style_config in styles:
            if style_config['id'] == style:
                style_template = style_config.get('prompt_template', '')
                break
        
        # If style has a template, use it; otherwise use default
        if style_template:
            # Determine if this is an algebra-related topic
            is_algebra = any(keyword in subtopic.lower() for keyword in ['algebra', 'equation', 'expression', 'variable', 'solve', 'linear', 'quadratic', 'polynomial'])
            
            # Build NO TEXT warning based on topic type
            if is_algebra:
                text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with limited algebra exception):
- NO subtopic names, NO titles, NO labels, NO year levels
- NO words like "Addition", "Subtraction", "Year 1", etc.
- NO descriptive text of any kind
- For ALGEBRA topics ONLY: Simple variables (x, y, a, b) or basic terms (2x, x²) are allowed
- Even for algebra: NO full equations written out, NO explanatory text
- The image should be PURELY VISUAL - geometric shapes and forms only
"""
            else:
                text_warning = """
ABSOLUTELY NO TEXT ALLOWED - ZERO TOLERANCE:
- NO text, NO letters, NO numbers, NO words, NO labels
- NO subtopic names (like "Addition", "Fractions", "Geometry", "Calendar Interpretation")
- NO year levels (like "Year 1", "Year 3", "Year 7")
- NO titles, NO captions, NO annotations
- NO time labels (like "1 week", "3 days", "Monday", "January")
- NO mathematical notation or symbols written as text
- The image MUST be 100% VISUAL ONLY - pure geometric shapes and forms
- If you're tempted to add text, DON'T - use visual representation instead
"""
            
            # Build the core content requirement with ultra-specific relevance requirements
            # CRITICAL: Put this BEFORE the style template so it takes priority
            core_content = f"""{text_warning}

CRITICAL TASK: Create an image representing the mathematical subtopic "{subtopic}" for {year_level} students.

ULTRA-CRITICAL RELEVANCE RULES - READ CAREFULLY:
- Show ONLY what is directly relevant to "{subtopic}" - ABSOLUTELY NOTHING ELSE
- For "Calendar" or "Calendar Interpretation": Show ONLY a simple calendar grid (rows and columns of squares) - NO text labels, NO weather icons, NO birthday cakes, NO decorative elements, NO "1 week", NO "3 days", NO month names
- For "Time": Show ONLY a simple clock face with hands - NO digital displays, NO text, NO calendars
- For "Cartesian Plane": Show ONLY x and y axes with maybe a single point - NO labels, NO graphs
- For "Simultaneous Linear Equations": Show ONLY two intersecting straight lines - NO text, NO labels
- For "Fractions": Show ONLY divided shapes representing parts - NO unrelated shapes
- For "Angles": Show ONLY angle formation with two rays - NO protractors
- For "{subtopic}": Show ONLY the core visual element - ask "What is the ONE thing that shows {subtopic}?"

WHAT TO ABSOLUTELY AVOID:
- NO weather icons (sun, clouds, rain) unless subtopic is specifically about weather
- NO birthday cakes, party hats, or celebration icons unless subtopic is about celebrations
- NO clocks unless subtopic is specifically about time
- NO calendars unless subtopic is specifically about calendars
- NO scales, rulers, or measuring tools unless subtopic is about measurement
- NO pie charts or graphs unless subtopic is specifically about that graph type
- NO decorative circles, rings, or ornamental shapes
- NO text labels of any kind (including "1 week", "3 days", month names, etc.)

MINIMALISM - EXTREME SIMPLICITY:
- Use 1-2 key elements maximum (often just 1 is enough!)
- Each element must DIRECTLY represent "{subtopic}"
- Remove anything that doesn't help explain "{subtopic}"
- Think: "What is the ONE thing that shows {subtopic}?"

CENTERING:
- ALL elements PERFECTLY CENTERED vertically and horizontally
- Generous empty space on ALL SIDES
- Balanced, symmetrical composition

"""
            
            # NOW add the style template AFTER the critical requirements
            prompt = core_content + "\n\nVISUAL STYLE TO APPLY:\n" + style_template
            
            # Add final reminder
            prompt += f"""

FINAL CRITICAL REMINDER:
- Do NOT include "{subtopic}" as text anywhere in the image
- Do NOT include "{year_level}" as text anywhere in the image  
- Do NOT include ANY words, labels, or text of any kind
- Do NOT include elements unrelated to "{subtopic}"
- Show ONLY the minimal visual representation of "{subtopic}"
"""
            
            # Ensure aspect ratio is included
            if 'Aspect ratio' not in prompt:
                prompt = f"{prompt}\nAspect ratio {config['aspect_ratio']} ({config['width']}x{config['height']}) - LANDSCAPE orientation."
            
            return prompt
        
        # Default/Original style prompt
        prompt = f"""Create a minimal, flat 3D illustration representing the mathematical subtopic "{subtopic}" for {year_level}.

Aspect ratio {config['aspect_ratio']} ({config['width']}x{config['height']}) - LANDSCAPE orientation.

Visual Style:
- Soft matte geometric shapes with subtle depth and shadows
- Muted pastel color palette: soft blue, mint green, coral pink, butter yellow, light cream
- Clean off-white/cream background
- Paper-craft aesthetic with layered flat elements
- 2-4 layers of overlapping shapes creating gentle depth

Composition:
- All elements perfectly centered
- Generous negative space
- Symmetrical or balanced layout
- Single clear focal point

Design Elements:
- Abstract geometric shapes representing the mathematical concept of "{subtopic}"
- Flowing curves and soft-edged forms
- Subtle shadows for depth (no harsh shadows)
- Smooth, matte surfaces

Style Guidelines:
- Friendly, modern, educational aesthetic
- Clean and uncluttered
- Mathematically accurate representation
- Professional yet approachable

CRITICAL REQUIREMENTS:
- NO text, NO characters, NO labels, NO numbers (unless this is an algebra-specific topic that requires minimal text)
- NO complex equations or formulas
- NO photorealistic elements
- Focus on abstract, symbolic representation of "{subtopic}"
- Must be mathematically accurate for the concept"""

        return prompt
    
    def _build_tutero_ai_prompt(self, context: str, config: Dict[str, Any], **kwargs) -> str:
        """Build prompt for Tutero AI image
        
        Args:
            context: Learning context
            config: Category configuration
            **kwargs: Additional parameters
            
        Returns:
            Prompt string
        """
        prompt = f"""Create a 3D rendered illustration showing ONLY the Tutero AI robot character in a scene related to {context}. 

CRITICAL REQUIREMENTS - MUST FOLLOW:
1. ASPECT RATIO: The image MUST be exactly {config['aspect_ratio']} aspect ratio ({config['width']}x{config['height']} pixels) - PORTRAIT orientation. This is NON-NEGOTIABLE.
2. CHARACTER DESIGN: Use the EXACT character design from the reference images provided. DO NOT modify the character's appearance.

Character (COPY EXACTLY from reference images):
- THIS IMAGE SHOWS ONLY THE TUTERO AI CHARACTER - NO STUDENTS OR OTHER PEOPLE
- Use the EXACT character design shown in the reference images
- EXACT body shape, colors, facial features, and all design details
- The character from the reference images is the ONLY character in this image
- Character positioned in or interacting with the {context} scene
- Takes up 40-60% of the frame as the sole character

Context Scene for {context}:
- The Tutero AI character (from reference images) is placed IN the context of {context}
- Background and setting appropriate to {context}
- The character may be:
  * Demonstrating something related to {context}
  * Positioned in a location relevant to {context}
  * Interacting with objects/elements from {context}
  * Experiencing or exploring {context}
- Scene should clearly show the context while keeping focus on the AI character
- Clean, professional, educational quality scene

Examples of Context Integration:
- If context is "Basketball": Character on a basketball court, perhaps holding a ball or near a hoop
- If context is "Ancient Egypt": Character in front of pyramids or Egyptian setting
- If context is "Skiing": Character on skis in a snowy mountain scene
- If context is "NFL": Character on a football field or with football elements
- The context is the SETTING, the character is the SUBJECT

Visual Style:
- Clean scene with just the character and context
- NO floating mathematical symbols or diagrams
- NO holographic overlays or tech particle effects
- Pure, clean illustration of the character in the scene
- Context-appropriate props or background elements only
- Uncluttered composition

Composition:
- Character as the central and ONLY character (40-60% of frame)
- Positioned prominently in the scene
- Clear connection between character and context
- Balanced, harmonious layout
- Context elements frame or support the character
- Eye level or slightly above
- Dynamic, engaging pose

Lighting & Mood:
- Bright, warm, inviting lighting appropriate to the context
- Gentle shadows creating depth
- Cheerful, positive, educational atmosphere
- Professional quality lighting
- Context-appropriate lighting

Style Guidelines:
- 3D rendered, modern illustration style (Pixar/modern animation quality)
- Friendly, approachable, non-threatening
- Educational and professional
- Polished, high-quality render
- Clean, modern aesthetic
- Character-focused composition

CRITICAL REQUIREMENTS:
- ONLY the Tutero AI robot character from the reference images - NO STUDENTS, NO OTHER PEOPLE
- The character MUST look EXACTLY like the reference images - DO NOT modify the design
- Character is the sole focus and hero of the image
- Context ({context}) is the SETTING/BACKGROUND, not additional characters
- The scene shows the character IN or WITH the context
- Professional educational quality
- Match the reference images EXACTLY for character design
- NO floating mathematical symbols, shapes, diagrams, or equations
- NO holographic overlays or tech particle effects
- Clean, pure scene with just the character and context"""

        return prompt
    
    def _build_classroom_prompt(self, activity: str, config: Dict[str, Any], **kwargs) -> str:
        """Build prompt for classroom activity image
        
        Args:
            activity: Learning activity description
            config: Category configuration
            **kwargs: Additional parameters
            
        Returns:
            Prompt string
        """
        age = kwargs.get('age', 'middle school')
        
        prompt = f"""Create a vibrant, illustrated scene showing the Tutero AI robot character physically present and helping diverse students with {activity} in a modern classroom setting.

CRITICAL REQUIREMENTS - MUST FOLLOW:
1. ASPECT RATIO: The image MUST be exactly {config['aspect_ratio']} aspect ratio ({config['width']}x{config['height']} pixels) - PORTRAIT orientation. This is NON-NEGOTIABLE.
2. CHARACTER DESIGN: Match the reference images EXACTLY for the Tutero AI character design.

Tutero AI Character (COPY EXACTLY from reference images):
- THE TUTERO AI CHARACTER MUST BE PHYSICALLY PRESENT IN THE SCENE
- Use the EXACT character design shown in the reference images
- DO NOT modify the character's appearance - copy it exactly
- EXACT body shape, colors, facial features, and all design details from reference images
- Physically present in the 3D space, NOT on a tablet, screen, or digital device
- Floating/hovering beside, among, or surrounded by the students
- Actively helping, demonstrating, or teaching the students
- Takes up 20-30% of the frame
- Positioned centrally or near the student group
- The robot is a CHARACTER in the scene, interacting with students face-to-face

Students (2-4 students):
- Diverse group: varied ethnicities, genders, appearances
- Age: {age} (12-17 years)
- Expressions: Engaged, enthusiastic, focused, collaborative
- Clothing: Casual contemporary school attire, varied colors
- Body language: Leaning in, gesturing, pointing, actively participating
- Interaction: Discussing with each other AND with the physical Tutero AI robot
- Looking at the AI robot, worksheets, or each other (NOT at tablets/screens)
- Gathered around a shared workspace with the AI robot among them

Setting & Environment:
- Modern classroom or collaborative learning space
- Contemporary desks/tables with students gathered around
- Learning materials: notebooks, textbooks, worksheets, whiteboards, physical manipulatives
- Background: Soft, muted (bookshelves, windows, educational posters - slightly blurred)
- Clean, organized, welcoming space
- NO tablets or digital screens as the primary focus
- NO AI character shown on digital devices
- Physical learning environment with hands-on materials

Learning Activity:
- Students working on {activity}
- Tutero AI robot actively assisting and teaching in person
- Visible materials related to the activity (worksheets, physical manipulatives, whiteboard)
- Mathematical content visible but not overwhelming
- Tools: calculators, rulers, protractors, markers, physical math tools, textbooks
- Clear focus on collaborative problem-solving with the physical AI character's help
- Students interacting directly with the AI robot

Color Palette:
- Tutero AI: Use EXACT colors from reference images
- Vibrant, energetic colors: bright blue (#3498DB), warm orange (#E67E22), fresh green (#27AE60)
- Diverse natural skin tones
- Varied colorful clothing for students
- Soft muted background (cream, light gray, soft blue)
- Pops of bright color in learning materials
- Warm, inviting color harmony

Composition:
- Tutero AI robot prominent (20-30% of frame), physically in the scene
- Students in foreground and mid-ground (50-60% of frame)
- Students clustered around shared workspace with AI robot among them or nearby
- Medium shot showing upper bodies, faces, and workspace
- Eye level or slightly above, showing interaction clearly
- Dynamic but balanced layout
- Clear sight lines between students and AI robot

Lighting & Atmosphere:
- Bright, natural, welcoming lighting (classroom lighting)
- Soft shadows creating depth
- Subtle glow from the AI robot character
- Warm, positive, collaborative atmosphere
- Energetic but focused mood
- Professional educational quality

Style Guidelines:
- Illustrated/semi-realistic (not photographic, not cartoon)
- Vibrant and engaging
- Diverse and inclusive representation
- Active learning visible
- Collaborative and supportive atmosphere with AI assistance
- Modern and contemporary
- 3D rendered or high-quality digital illustration

CRITICAL REQUIREMENTS:
- The Tutero AI robot MUST be physically present in the scene as a 3D character
- The AI robot is NOT on a screen, tablet, or digital device
- The AI character MUST look EXACTLY like the reference images - DO NOT modify the design
- Students are surrounded by or gathered around the physical AI robot
- Must show 2-4 diverse students actively collaborating with the physical AI robot
- Students must be actively working together (not passive)
- Activity ({activity}) must be clearly integrated
- Atmosphere must be positive and engaging
- Professional educational quality
- Inclusive and representative
- The AI robot is a physical character in the scene, helping students directly
- NO digital screens showing the AI - the AI is there in person
- Copy the character design from reference images EXACTLY"""

        return prompt
    
    def _build_context_prompt(self, context: str, config: Dict[str, Any], **kwargs) -> str:
        """Build prompt for context introduction image
        
        Args:
            context: Real-world context
            config: Category configuration
            **kwargs: Additional parameters
            
        Returns:
            Prompt string
        """
        prompt = f"""Create a professional, semi-realistic illustration showing {context}.

Aspect ratio {config['aspect_ratio']} ({config['width']}x{config['height']}) - LANDSCAPE orientation.

Context Scene (CRITICAL - MUST BE ACCURATE):
- Real-world scenario: {context}
- Setting: Appropriate and ACCURATE to the context (field, court, building, nature, etc.)
- Perspective: Dynamic/strategic/architectural angle showing the context clearly
- Elements: Context-specific elements that are REALISTIC and ACCURATE to {context}
- Atmosphere: Inspiring, dynamic, professional, and engaging
- MUST accurately represent the actual context of {context}

Visual Style:
- Semi-realistic, high-quality illustration
- Professional, polished, editorial quality
- Context-appropriate color palette
- Clear, clean composition
- NO text, NO words, NO labels
- NO mathematical overlays or diagrams (just the pure context scene)

Composition:
- Context as the sole focus (100%)
- Balanced, harmonious layout
- Clear foreground and background
- Professional framing

Lighting & Mood:
- Natural lighting appropriate to context
- Inspiring and practical atmosphere
- Clear visibility of all elements
- Professional educational quality
- Engaging and relatable

CRITICAL REQUIREMENTS:
- Context ({context}) must be ACCURATELY and REALISTICALLY represented
- NO TEXT, NO WORDS, NO LABELS, NO EXPLANATIONS in the image
- NO mathematical symbols, numbers, lines, or overlays
- Just the pure, high-quality illustration of the scene
- Professional, high-quality illustration
- Clear educational value as a context setter
- Not too cluttered - maintain clarity
- Scene must be contextually accurate to {context}"""

        return prompt
