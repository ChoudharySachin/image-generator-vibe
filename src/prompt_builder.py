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
            **kwargs: Additional parameters (year_level, age, style, variation_index, total_variations)
            
        Returns:
            Complete prompt for image generation
        """
        category_config = self.config.get_category(category)
        
        # Get dimensions from kwargs if provided, otherwise from config
        width = kwargs.get('width', category_config['width'])
        height = kwargs.get('height', category_config['height'])
        aspect_ratio = kwargs.get('aspect_ratio', category_config['aspect_ratio'])
        
        # Update config object for sub-builders or pass directly
        current_config = category_config.copy()
        current_config['width'] = width
        current_config['height'] = height
        current_config['aspect_ratio'] = aspect_ratio

        # Build prompt based on category
        if category == 'subtopic_cover':
            prompt = self._build_subtopic_prompt(user_input, current_config, **kwargs)
        elif category == 'tutero_ai':
            prompt = self._build_tutero_ai_prompt(user_input, current_config, **kwargs)
        elif category == 'classroom_activity':
            prompt = self._build_classroom_prompt(user_input, current_config, **kwargs)
        elif category == 'context_introduction':
            prompt = self._build_context_prompt(user_input, current_config, **kwargs)
        else:
            raise ValueError(f"Unknown category: {category}")
        
        # Add variation instruction if multiple images are being generated
        variation_index = kwargs.get('variation_index')
        total_variations = kwargs.get('total_variations')
        
        if variation_index is not None and total_variations is not None and total_variations > 1:
            prompt += f"\n\nVARIATION INSTRUCTION ({variation_index + 1}/{total_variations}):\n"
            prompt += "Ensure this image has a UNIQUE composition, camera angle, or specific pose compared to other variations.\n"
            
            if category == 'tutero_ai':
                # Check for net sports to enforce specific camera rules
                is_net_sport = any(sport in user_input.lower() for sport in ['tennis', 'badminton', 'volleyball'])

                # Advanced Variation Logic for Context-Aware Diversity
                if variation_index == 0:
                    prompt += "- POSE: **CORE ACTION**. Show the character performing the PRIMARY skill or action of the context (e.g., kicking the ball TOWARDS the goal, swinging a bat, writing on a board).\n"
                elif variation_index == 1:
                    prompt += "- POSE: **ALTERNATIVE/REACTIVE ROLE**. Show a different aspect of the context (e.g., Goalkeeper making a save, fielding a ball, observing an experiment, listening).\n"
                elif variation_index == 2:
                    prompt += "- POSE: **HIGH ENERGY/DYNAMIC**. A high-intensity moment (e.g., sprinting, jumping HIGH for a catch/mark, diving save). **MUST BE SAFE AND POSITIVE** - NO aggressive contact, NO jumping ON other players.\n"
                else:
                    prompt += "- POSE: **COMPOSED/STRATEGIC**. A calm, focused moment (e.g., lining up a penalty shot, analyzing the field, holding equipment ready, confident stance).\n"
                
                prompt += "- **LOGICAL ORIENTATION**: Ensure the action makes physical sense. (e.g., If kicking a goal, face the goal. If batting, face the pitcher).\n"
                
                if is_net_sport:
                    prompt += "- **NET SPORT CAMERA**: Use a SIDE PROFILE or BACK VIEW. Do NOT use a front view if hitting the ball. Ensure the character looks at the ball, not the camera.\n"
                else:
                    prompt += "- VARY the camera angle (low angle, eye level, side view, wide shot).\n"
                
                prompt += "- ENSURE THE TIE IS VISIBLE and STABLE (flat against body, not flying) in this pose.\n"
            
            elif category == 'classroom_activity':
                # Variation Logic for Classroom Scenes
                if variation_index == 0:
                    prompt += "- COMPOSITION: **SIDE-BY-SIDE**. The AI character is SITTING next to a student, looking at their work together.\n"
                elif variation_index == 1:
                    prompt += "- COMPOSITION: **GROUP CENTER**. The AI character is STANDING at the head of the table, demonstrating something to the whole group.\n"
                elif variation_index == 2:
                    prompt += "- COMPOSITION: **ACTIVE TEACHING**. The AI character is pointing at a physical object or whiteboard while students look on.\n"
                else:
                    prompt += "- COMPOSITION: **ENGAGED LISTENING**. The AI character is leaning in, listening to a student explain their answer.\n"
                
                prompt += "- **NO FLOATING**: Ensure the character is firmly grounded on the floor or chair. NO hovering.\n"
            
            prompt += "While strictly adhering to all design/character requirements, make this specific image visually distinct."
        
        self.logger.debug(f"Built prompt for category '{category}'", {
            'category': category,
            'user_input': user_input,
            'prompt_length': len(prompt),
            'variation': f"{variation_index + 1}/{total_variations}" if variation_index is not None else "single"
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
            # Remove strict text constraints from style template to allow core_content to govern permissions
            style_template = style_template.replace("CRITICAL: NO text, NO characters, NO labels, NO numbers.", "")
            style_template = style_template.replace("NO text, NO written equations, NO labels, NO numbers.", "") # For hand_drawn_chalk
            
            # Determine if this is an algebra-related topic
            is_algebra = any(keyword in subtopic.lower() for keyword in ['algebra', 'equation', 'expression', 'variable', 'solve', 'linear', 'quadratic', 'polynomial', 'factoris', 'factor', 'cubic', 'quartic', 'expand', 'division', 'divid'])
            
            # Determine if this is a logarithm/exponent topic
            is_logarithm = any(keyword in subtopic.lower() for keyword in ['logarithm', 'log', 'exponent', 'exponential', 'power', 'index', 'indices'])
            
            # Determine if this is a trigonometry topic
            is_trigonometry = any(keyword in subtopic.lower() for keyword in ['trigonometry', 'trig', 'sine', 'cosine', 'tangent', 'hypotenuse', 'pythagoras', 'elevation', 'depression', 'bearing', 'triangle', 'unit circle', 'degree', 'radian'])
            
            # Determine if this is a calculus topic
            is_calculus = any(keyword in subtopic.lower() for keyword in ['calculus', 'derivative', 'integration', 'integral', 'rate of change', 'gradient function', 'area under curve', 'limit', 'differentiation', 'antiderivative'])

            # Determine if this is a statistics/probability topic
            is_statistics = any(keyword in subtopic.lower() for keyword in ['statistics', 'data', 'distribution', 'probability', 'random variable', 'mean', 'median', 'mode', 'standard deviation', 'variance', 'bivariate', 'scatter', 'histogram', 'frequency', 'outlier', 'correlation', 'regression'])

            # Determine if this is a statistics/probability topic
            is_statistics = any(keyword in subtopic.lower() for keyword in ['statistics', 'data', 'distribution', 'probability', 'random variable', 'mean', 'median', 'mode', 'standard deviation', 'variance', 'bivariate', 'scatter', 'histogram', 'frequency', 'outlier', 'correlation', 'regression'])

            # Determine if this is a geometry topic
            is_geometry = any(keyword in subtopic.lower() for keyword in ['geometry', 'theorem', 'angle', 'circular', 'shape', 'polygon', 'perimeter', 'area', 'volume', 'surface area', 'parallel', 'perpendicular'])

            # Determine if this is a graphing/functions topic
            is_graphing = any(keyword in subtopic.lower() for keyword in ['graph', 'plot', 'axis', 'axes', 'coordinate', 'parabola', 'hyperbola', 'circle', 'ellipse', 'asymptote', 'intercept', 'slope', 'domain', 'range', 'transformation', 'sketch', 'quartic', 'quadratic'])
            
            # Determine if this is a number/arithmetic topic
            
            # Determine if this is a number/arithmetic topic
            is_number = any(keyword in subtopic.lower() for keyword in ['number', 'fraction', 'decimal', 'percentage', 'ratio', 'scientific notation', 'rounding', 'estimation', 'arithmetic', 'addition', 'subtraction', 'multiplication', 'division', 'count', 'integer', 'expansion', 'index'])
            
            # FORCE TECHNICAL STYLE for specific topics to prevent "bad abstract art"
            if is_trigonometry or is_calculus or is_statistics or is_graphing or is_geometry:
                style_template = """
VISUAL STYLE: HIGH-END 3D MINIMALISM (Mathematically Precise)
- **AESTHETICS**: Soft, high-quality lighting with a gentle pastel background gradient (e.g., soft cream to pale blue).
- **SUBJECT**: The mathematical object (e.g., Triangle, Graph, Dice) should look like a premium 3D physical model or a clean vector floating in space.
- **LINES**: Technical lines must be crisp and dark (Navy/Black) for readability.
- **DEPTH**: Use subtle drop shadows to create a "floating" effect, centered on the page.
- **COLOR PALETTE**: Muted pastels (Sage Green, Terra Cotta, Slate Blue, Mustard) for the shapes. NO neon or jarring colors.
- **BACKGROUND**: Clean, but NOT plain white. Use a very soft, smooth gradient.
- **CRITICAL**: The ART must NOT distort the MATH.
  * A "Parabola" must be a perfect curve.
  * A "Triangle" must have straight edges.
  * NO "paper cut" ragged edges on diagrams.
  * NO decorative confetti or random shapes around the object.
"""

            # Build NO TEXT warning based on topic type
            if is_calculus:
                text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with CALCULUS exception):
- NO subtopic names, NO titles, NO labels
- ALLOWED SYMBOLS: Integral (∫), derivative (d/dx, f'(x), dy/dx), limits, function labels (f(x)), axis labels (x, y).
- VISUALS: Show SMOOTH CURVES with tangents independently or area shading.
- STRICTLY NO SENTENCES. Only mathematical notation.
- Graph axes must be clean and simple.
"""
            elif is_statistics:
                if "experimental" in subtopic.lower():
                    text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with EXPERIMENTAL PROBABILITY exception):
- CRITICAL: NO COMPLEX TABLES containing text. NO blurry numbers.
- VISUALS: Show the EXPERIMENT DEVICE (Dice, Spinner, Coin).
- DATA: Show simple TALLY MARKS (||||) or a simple BAR CHART to represent frequency.
- STRICTLY NO SENTENCES or messy formulas.
"""
                else:
                    text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with STATISTICS exception):
- NO subtopic names, NO titles, NO labels
- ALLOWED SYMBOLS: Greek letters (μ, σ), P(X), axis labels, data points.
- VISUALS: Show DISTRIBUTION CURVES (Bell curve), HISTOGRAMS, or SCATTER PLOTS.
- Data visualization must be clean and precise.
- STRICTLY NO SENTENCES.
"""
            elif is_geometry:
                text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with GEOMETRY exception):
- CRITICAL: NO LABELS. NO letters (A, B, C, r, x). NO weird symbols.
- VISUALS ONLY: Show the geometric relationship purely through lines, shapes, and colors.
- Use MATCHING COLORS to show equal angles or sides.
- STRICTLY NO TEXT.
"""
            elif is_graphing:
                text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with GRAPHING exception):
- CRITICAL: NO NUMBERS on axes. NO Equation text. NO Coordinate labels.
- REASON: Text labels often render poorly.
- VISUALS: Show a clean CARTESIAN GRID (x and y axes) and the PERFECT CURVE/LINE only.
- STRICTLY NO TEXT LABELS. Just the geometric plot.
"""
            elif is_number and not is_algebra:
                if "naming" in subtopic.lower() or "name" in subtopic.lower():
                    text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with NUMBER NAMING exception):
- ALLOWED: You MUST show the Number Digit and its Word Name.
- EXAMPLES: "1 One", "2 Two", "10 Ten", "100 One Hundred".
- VISUALS: Show the pairing clearly.
- STRICTLY NO SENTENCES.
"""
                elif "fraction" in subtopic.lower():
                    if any(word in subtopic.lower() for word in ['calculation', 'add', 'subtract', 'plus', 'minus', 'sum', 'difference', 'operation', 'multiply', 'divide']):
                        text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with FRACTION CALCULATION exception):
- INSTRUCTION: Show the FRACTION MATH PROBLEM (e.g., "1/2 + 3/4").
- VISUALS: Use BAR MODELS (Rectangles) to represent the fractions. DO NOT use Pie Charts (Circles) as they are often inaccurate for operations.
- ACCURACY: The visual quantities in the bar models MUST match the numbers.
- STRICTLY NO sentences.
"""
                    else:
                        text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with FRACTION exception):
- CRITICAL: NO COMPLEX EQUATIONS containing formulas.
- VISUALS ONLY: Show the FRACTION visually using BAR MODELS (Rectangles) or simple PIE CHARTS.
- EXAMPLE: Show a shape clearly divided into equal parts with some shaded.
- LABELS: Simple fraction labels (e.g. "1/4") are allowed if large and clear.
- STRICTLY NO long mathematical sentences.
"""
                elif any(op in subtopic.lower() for op in ['multiplication', 'division', 'multiply', 'divide', 'operation']):
                    text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with OPERATION exception):
- INSTRUCTION: Show the MATH EXPRESSION ONLY (e.g., "423 × 24" or "15 ÷ 3").
- CRITICAL: NO CALCULATIONS. NO WORKING OUT. NO ANSWER.
- VISUALS: Large, clear numbers and the operator.
- STRICTLY NO SENTENCES.
"""
                else:
                    text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with NUMBER/ARITHMETIC exception):
- NO subtopic names, NO titles
- ALLOWED SYMBOLS: Numbers, Fractions, Decimals, %, Scientific Notation, Operators (+, -, x, ÷).
- VISUALS: Show clear, readable numbers and operators.
- STRICTLY NO SENTENCES.
"""
            elif is_algebra:
                text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with limited algebra exception):
- NO subtopic names, NO titles, NO labels, NO year levels
- NO words like "Algebra", "Equation", "Factorising", etc.
- For ALGEBRA topics: You MUST show CONCRETE algebraic terms, expressions, or equations.
- EXAMPLES:
  * For "Terms": Show 3x, 4y, 2a
  * For "Equations": Show x + 5 = 12 or 2x - 3 = 7
  * For "Quadratics": Show x² + 5x + 6 = (x+2)(x+3)
  * For "Factorising Cubics": Show x³ - 6x² + 11x - 6 = (x-1)(x-2)(x-3)
  * For "Factorising Quartics": Show x⁴ - 5x² + 4 = (x²-1)(x²-4)
  * For "Polynomial Division": Show the division setup ONLY (dividend inside, divisor outside). NO STEPS. NO WORKING OUT. NO QUOTIENT.
- CRITICAL: Do NOT use abstract 3D shapes, cubes, geometric objects, or decorative elements.
- CRITICAL: Do NOT arrange algebraic terms in decorative patterns (houses, grids, artistic layouts).
- STRICTLY NO WORDS or SENTENCES. Only mathematical notation.
- The image should show ACTUAL ALGEBRA - not geometric shapes.
"""
            elif is_trigonometry:
                text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with TRIGONOMETRY exception):
- CRITICAL: NO LABELS. NO letters (No H, O, A, a, b, c).
- ALLOWED SYMBOLS: ONLY the Theta (θ) angle symbol inside the triangle.
- VISUALS: Show a RIGHT-ANGLED TRIANGLE (One 90-degree corner). It MUST be asymmetric (NOT equilateral).
- GEOMETRY: One vertical side, one horizontal side, meeting at 90 degrees.
- STRICTLY NO TEXT. Just the geometric shape.
"""
            elif is_logarithm:
                text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with LOGARITHM exception):
- CRITICAL: NO LABELS. NO titles. NO numbers on axes. NO equations.
- VISUALS: Show a simple LOGARITHMIC GRAPH (curve of y = log x) on clean X-Y axes.
- STRICTLY NO TEXT. Just the curve and the axes lines.
"""
            elif any(keyword in subtopic.lower() for keyword in ['sequence', 'arithmetic', 'geometric', 'series']):
                text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with SEQUENCE exception):
- NO subtopic names, NO titles, NO labels, NO year levels
- NO words like "Arithmetic", "Sequence", "Geometric", etc.
- NO descriptive text of any kind
- For SEQUENCE topics: You MUST show actual NUMBERS in the sequence (e.g., 3, 7, 11, 15, 19).
- For ARITHMETIC SEQUENCES: Show the numbers AND the common difference (e.g., +4 between terms).
- For GEOMETRIC SEQUENCES: Show the numbers AND the common ratio (e.g., ×2 between terms).
- VISUALS: Display the numbers clearly in sequence order. Style them artistically but keep them readable.
- STRICTLY NO WORDS or SENTENCES. Only numbers and mathematical operators (+, -, ×, ÷).
- Do NOT use random colored shapes - use actual numbers in sequence.
"""
            elif any(keyword in subtopic.lower() for keyword in ['counting', 'skip count', 'count']):
                text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with COUNTING exception):
- NO subtopic names, NO titles, NO labels, NO year levels
- NO words like "Counting", "Skip", "Odd", "Even", etc.
- NO descriptive text of any kind
- For COUNTING topics: You MUST show actual NUMBERS in the counting sequence.
- CRITICAL TERMINOLOGY:
  * "Odd skip counting" = counting by 3s (e.g., 1, 4, 7, 10, 13 or 2, 5, 8, 11, 14)
  * "Even skip counting" = counting by 4s (e.g., 1, 5, 9, 13, 17 or 2, 6, 10, 14, 18)
  * "Counting by 2s" = 2, 4, 6, 8, 10 OR 1, 3, 5, 7, 9
  * "Counting by 5s" = 5, 10, 15, 20, 25
  * "Counting by 10s" = 10, 20, 30, 40, 50
- CRITICAL ACCURACY: Every number in the sequence must be correct with NO DUPLICATES and NO GAPS.
- VISUALS: Display ONLY the numbers. Do NOT add decorative shapes, dots, or containers around numbers.
- STRICTLY NO WORDS or SENTENCES. Only the numbers in sequence.
- For Year 1-3: Keep it extremely simple - just show the numbers clearly.
"""
            elif any(keyword in subtopic.lower() for keyword in ['integer', 'negative number', 'positive number', 'whole number']):
                if "negative" in subtopic.lower() and "positive" not in subtopic.lower():
                    text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with NEGATIVE NUMBER exception):
- CRITICAL: Show PRIMARILY NEGATIVE numbers.
- ALLOWED: -5, -4, -3, -2, -1, 0.
- VISUALS: Show individual negative integers clearly.
- STRICTLY NO POSITIVE NUMBERS if the subtopic is purely "Negative Numbers", to avoid confusion.
- STRICTLY NO WORDS.
"""
                else:
                    text_warning = """
ABSOLUTELY NO TEXT ALLOWED (with INTEGER exception):
- NO subtopic names, NO titles, NO labels, NO year levels
- NO words like "Integer", "Negative", "Positive", etc.
- NO descriptive text of any kind
- For INTEGER topics: You MUST show actual INTEGER NUMBERS in a COMPLETE, CONSECUTIVE sequence.
- CRITICAL: Show a proper sequence like: -3, -2, -1, 0, 1, 2, 3 (NO GAPS, NO MISSING NUMBERS).
- VISUALS: Display the integers clearly and in order. Include negative numbers (with minus sign), zero, and positive numbers.
- STRICTLY NO WORDS or SENTENCES. Only integer numbers in proper sequence.
- Do NOT use abstract number lines, arrows, or colored shapes - use actual integer numbers.
- MATHEMATICAL ACCURACY: Ensure all consecutive integers are present with no gaps.
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
            core_content = f"""
CRITICAL TASK: Create a minimal, centered illustration representing the mathematical subtopic "{subtopic}" for {year_level} students.

**MATHEMATICAL ACCURACY IS THE #1 PRIORITY**:
- The image MUST be 100% mathematically accurate for "{subtopic}".
- Every element must be a direct, accurate representation of the mathematical concept.
- If showing "{subtopic}" requires numbers, variables, or mathematical symbols, INCLUDE THEM.
- Reference images are for STYLE inspiration only - NOT content. Do not copy their subject matter.
- Minimalism is important, but ACCURACY comes first.
- **CRITICAL**: Do NOT use abstract decorative shapes (3D cubes, geometric objects, floating shapes) for mathematical topics like algebra, factorising, sequences, etc. Show the ACTUAL mathematics.

{text_warning}

ULTRA-CRITICAL RELEVANCE RULES - READ CAREFULLY:
- **100% RELEVANCE**: Every single element must be DIRECTLY relevant to "{subtopic}".
- **NO ABSTRACT ELEMENTS**: Do not include random shapes, blobs, or decorations. If it's not directly showing "{subtopic}", remove it.
- **YEAR-LEVEL COMPLEXITY**: The visual MUST match {year_level} complexity. Year 11 requires sophisticated mathematical notation (sequences with formulas, complex terms). Year 1-3 requires simple visuals. DO NOT use simple shapes for advanced topics.
- **CONTENT**: ABSOLUTELY NOTHING ELSE but the core concept.
- For "Calendar" or "Calendar Interpretation": Show ONLY a simple calendar grid (rows and columns of squares) - NO text labels, NO weather icons, NO birthday cakes, NO decorative elements, NO "1 week", NO "3 days", NO month names
- For "Time": Show ONLY a simple clock face with hands - NO digital displays, NO text, NO calendars
- For "Cartesian Plane": Show ONLY x and y axes with maybe a single point - NO labels, NO graphs
- For "Simultaneous Linear Equations": Show ONLY two intersecting straight lines - NO text, NO labels
- For "Fractions": Show ONLY divided shapes representing parts - NO unrelated shapes
- For "Angles": Show ONLY angle formation with two rays - NO protractors
- For "Algebra" or "Terms": Show CONCRETE algebraic terms like '3x', '4y', or '2a'. Do NOT show random squares or circles.
- For "Factorising" (cubics, quartics, quadratics): Show the ACTUAL algebraic expression and its factored form (e.g., x³ - 6x² + 11x - 6 = (x-1)(x-2)(x-3) or x² + 5x + 6 = (x+2)(x+3)). CRITICAL: Do NOT show abstract 3D cubes, geometric shapes, or decorative objects.
- For "Polynomial Division" or "Long Division": Show the EXPRESSION ONLY (e.g., (x³+2x) ÷ (x-1)). NO STEPS. NO WORKING OUT. NO ANSWER. Just the problem.
- For "Logarithms" or "Exponents": Show a CLEAN LOGARITHMIC GRAPH (curve of y = log x) on simple axes. NO LABELS. NO EQUATIONS. Show the curve rising and tapering off.
- For "Counting" or "Skip Counting": Show the COMPLETE, ACCURATE number sequence. CRITICAL TERMINOLOGY: "Odd skip counting" = counting by 3s (e.g., 1, 4, 7, 10, 13), "Even skip counting" = counting by 4s (e.g., 1, 5, 9, 13, 17). NO duplicates, NO gaps, NO missing numbers. Do NOT add decorative shapes or containers.
- For "Arithmetic Sequence" or "Geometric Sequence": Show actual NUMBERS in sequence (e.g., 3, 7, 11, 15, 19 with +4 shown for arithmetic). Include the pattern indicator (common difference or ratio). Do NOT show random shapes.
- For "Number Sequences" or "Patterns": Show actual NUMBERS in sequence (e.g., 2, 4, 6, 8) or a clear visual pattern. Do NOT show random colored circles or shapes.
- For "Integer" or "Negative Numbers": Show actual INTEGER numbers in COMPLETE CONSECUTIVE order (e.g., -3, -2, -1, 0, 1, 2, 3). CRITICAL: NO GAPS - every integer must be present in sequence. Do NOT show abstract number lines or arrows - show the actual numbers.
- For "Trigonometry" (Foundations, Pythagoras, SOHCAHTOA): Show a SINGLE, CLEAN RIGHT-ANGLED TRIANGLE.
  * GEOMETRY: Must have ONE vertical side and ONE horizontal side forming an 'L' shape (90 degrees).
  * The third side (Hypotenuse) connects them.
  * Do NOT show an Equilateral or Isosceles triangle.
  * MUST include the right-angle symbol (small square in corner).
  * MARK the angle Theta (θ).
  * NO OTHER LABELS. Remove all letters/sides. Clean lines only.
  * BACKGROUND: 100% CLEAN. Pure solid color. REMOVE ALL decorative circles at the bottom. REMOVE floating shapes.
  * STYLE: Technical diagram style, not "paper craft" or "watercolor". Thin, crisp lines.
  * ABSOLUTELY NO "Adjacent", "Opposite", "Hypotenuse".
  * For "Unit Circle": Show a circle centered on X-Y axes with a triangle formed inside.
  * NO abstract art - create a TEXTBOOK-STYLE diagram.
- For "Calculus" (Derivatives, Integration): Show a 2D Cartesian Graph with a smooth function curve.
  * For "Integration": Shade the AREA under the curve. Show the integral symbol ∫.
  * For "Derivatives": Show a TANGENT LINE touching the curve at a point. Label the slope.
- For "Geometry" (Angles, Shapes, Theorems): Show PURE GEOMETRIC FORMS.
  * For "Circle Theorems": Show the circle and the lines/angles clearly. Use COLOR CODING (not text) to show relationships.
  * For "Polygons": Show the shape clearly.
  * NO LABELS on vertices or sides.
- For "Statistics" (Distributions, Probability): Show a clear STATISTICAL CHART.
  * For "Binomial/Normal Distribution": Show a smooth BELL CURVE or Histogram.
  * For "Bivariate Data": Show a SCATTER PLOT with a line of best fit.
  * For "Probability": Show a Spinner, Dice, or Tree Diagram (clean).
  * For "Experimental Probability": Show a TALLY SHEET (marks like ||||) or a simple BAR CHART next to a Dice or Spinner. NO complex text tables.
- For "Graphs" (Parabolas, Quartics, Linear): Show a clear 2D PLOT on X-Y Axes.
  * For "Parabola": Show a U-shaped curve.
  * For "Quartic": Show a W-shaped or M-shaped curve.
  * For "Linear": Show a straight line.
  * For "Domain & Range": Highlight the valid proportions of the curve.
- For "Number" (Fractions, Percentages, Scientific Notation): Show the CONCRETE math representation.
  * For "Fractions": Show a circle or rectangle clearly divided into parts.
  * For "Scientific Notation": Show the notation (e.g., 3.5 × 10⁴).
  * For "Ratio": Show groups of objects in comparison (e.g., 2 red dots : 3 blue dots).
  * For "Naming Numbers": Show the DIGIT and its WORD NAME pair (e.g., "1 One", "5 Five").
- For "{subtopic}": Show ONLY the core visual element - ask "What is the ONE thing that shows {subtopic}?"

WHAT TO ABSOLUTELY AVOID:
- NO weather icons (sun, clouds, rain) unless subtopic is specifically about weather
- NO birthday cakes, party hats, or celebration icons unless subtopic is about celebrations
- NO clocks unless subtopic is specifically about time
- NO calendars unless subtopic is specifically about calendars
- NO scales, rulers, or measuring tools unless subtopic is about measurement
- NO pie charts or graphs unless subtopic is specifically about that graph type
- NO decorative circles, rings, or ornamental shapes
- NO floating spheres, orbs, or dots
- NO abstract 3D objects (cubes, cylinders, spheres, pyramids) unless the subtopic is specifically about 3D geometry
- NO abstract shapes for Algebra/Factorising topics - use the actual algebraic expressions and notation
- NO decorative arrangements of algebraic terms (house shapes, artistic grids, decorative patterns)
- NO random unrelated shapes (circles, squares, triangles, stars, pentagons) unless the subtopic is specifically about those shapes
- NO random floating shapes (squares, circles) if the topic is specific (e.g., Triangles)
- NO text labels of any kind (including "1 week", "3 days", month names, etc.)
- NO background elements - keep the background completely clean (NO grid floors, NO perspective grids, NO horizon lines, NO decorative patterns)

MINIMALISM - EXTREME SIMPLICITY:
- Use 1-2 key elements maximum (often just 1 is enough!)
- **ZERO EXTRA ELEMENTS**: No floating dots, no random circles, no background decorations.
- **NO DECORATIVE CONTAINERS**: Do not place numbers inside shapes, ovals, cards, or boxes unless absolutely necessary.
- **NO FLOATING SPHERES/ORBS**: Do not place random balls, spheres, or dots around the main subject.
- If the subtopic is "Triangles", show ONLY triangles. Do not add squares or circles.
- For Year 1-3 topics: Use MAXIMUM simplicity - just show the core numbers or shapes with NO decorative elements.
- Remove anything that doesn't help explain "{subtopic}"
- Think: "What is the ONE thing that shows {subtopic}?"
- The image should be as minimal as possible while still being accurate.

CENTERING & SIZE - ABSOLUTELY NON-NEGOTIABLE:
- **EXTREME ZOOM OUT REQUIRED**. The subject MUST be TINY - like viewing a coin on a large table from 10 feet away.
- **MAXIMUM SIZE LIMIT**: The visual element should occupy ONLY 15-25% of the total image area (ABSOLUTE MAXIMUM).
- **BIRD'S EYE VIEW**: Frame as if looking down at a small object on a vast empty surface.
- **NO CROPPING WHATSOEVER**: The entire subject must be fully visible with MASSIVE margins. NEVER cut off ANY edges or parts.
- **PERFECTLY CENTERED**: The subject must be centered BOTH Vertically AND Horizontally - exact mathematical center of the canvas.
- **ENORMOUS MARGINS**: Maintain at least 40-45% empty space on ALL FOUR sides (top, bottom, left, right).
- **TINY FLOATING EFFECT**: The design must feel like a SMALL object "floating" in the center, surrounded by VAST clean background.
- **STRICT PROHIBITION**: 
  * Do NOT make elements large or fill the frame
  * Do NOT let ANY elements touch or approach the edges
  * Do NOT add multiple copies or variations of the main element
  * Do NOT add decorative elements around the main subject
- **SYMMETRY**: The composition must be perfectly symmetrical and balanced around the exact center point.
- **NO OFF-CENTER**: Do NOT place elements in corners, sides, or off-center positions.
- **SINGLE ELEMENT ONLY**: Show ONLY ONE instance of the main element (e.g., ONE clock, ONE spinner, ONE set of numbers) - NO duplicates or smaller versions.

ACCURACY:
- The visual representation must be mathematically accurate for "{subtopic}".
- Ensure the key features of the subtopic are clearly visible and correct.

"""
            
            # NOW add the style template AFTER the critical requirements
            prompt = core_content + "\n\nVISUAL STYLE TO APPLY:\n" + style_template
            
            # Add final reminder
            prompt += f"""

FINAL CRITICAL REMINDER:
- Do NOT include "{subtopic}" as text anywhere in the image
- Do NOT include "{year_level}" as text anywhere in the image  
- Do NOT include ANY words, labels, or text of any kind (EXCEPT mathematical notation for algebra/math topics)
- Do NOT include elements unrelated to "{subtopic}"
- Show ONLY the minimal visual representation of "{subtopic}"
- **ABSOLUTELY NO BACKGROUND ELEMENTS**: NO grid floors, NO perspective grids, NO horizon lines, NO decorative backgrounds
- **CLEAN SOLID BACKGROUND ONLY**: Use a simple, solid-color or gradient background with NO patterns or elements
- **CONCRETE EXAMPLES ONLY**: For algebra/math topics, show ACTUAL worked examples with real numbers, NOT generic templates with placeholder variables
- **PERFECT CENTERING**: Ensure the subject is in the exact center with massive margins on all sides
"""
            
            # STRONG NEGATIVE PROMPT INJECTION
            negative_prompt = "text, writing, words, letters, low quality, blurry, distorted, messy, confusing, abstract art, complex markings, watermark, signature"
            
            if "fraction" in subtopic.lower():
                 negative_prompt += ", equations, formulas, plus sign, equals sign, algebra, complex text"
            
            if is_graphing:
                 negative_prompt += ", number labels, text labels, letters, grid numbers, coordinates, axis numbers"

            if "probability" in subtopic.lower() or "statistics" in subtopic.lower() or "experimental" in subtopic.lower():
                 negative_prompt += ", tables, grids, words, blurry numbers, text chart, excel table"
            
            if is_logarithm:
                 negative_prompt += ", log text, equations, formulas, algebra, writing, letters, variables"

            prompt += f"\n\nNEGATIVE PROMPT: {negative_prompt}"
            
            # Ensure aspect ratio is included
            if 'Aspect ratio' not in prompt:
                orientation_desc = "LANDSCAPE" if config['width'] > config['height'] else "PORTRAIT"
                prompt = f"{prompt}\nAspect ratio {config['aspect_ratio']} ({config['width']}x{config['height']}) - {orientation_desc} orientation."
            
            return prompt
        
        # Default/Original style prompt
        orientation_desc = "LANDSCAPE" if config['width'] > config['height'] else "PORTRAIT"
        prompt = f"""Create a minimal, centered, flat 3D illustration representing the mathematical subtopic "{subtopic}" for {year_level}.

Aspect ratio {config['aspect_ratio']} ({config['width']}x{config['height']}) - {orientation_desc} orientation.

Visual Style:
- Soft matte geometric shapes with subtle depth and shadows
- Muted pastel color palette: soft blue, mint green, coral pink, butter yellow, light cream
- Clean off-white/cream background - NO background patterns or elements
- Paper-craft aesthetic with layered flat elements
- 2-4 layers of overlapping shapes creating gentle depth

Composition - CRITICAL:
- ALL elements PERFECTLY CENTERED in the middle of the image
- The visual element should occupy ONLY 40-50% of the total image area
- Maintain a LARGE margin of empty space (at least 25%) on all sides
- Do NOT make the elements huge - keep them contained in the center
- Symmetrical or balanced layout around the center
- Single clear focal point in the center
- Do NOT place elements in corners

Design Elements:
- CONCRETE visual representations of the mathematical concept "{subtopic}"
- NO abstract art or decorative shapes - every element must be mathematically relevant
- Flowing curves and soft-edged forms
- Subtle shadows for depth (no harsh shadows)
- Smooth, matte surfaces
- MINIMALISM: Use only the essential elements to represent the concept

Style Guidelines:
- Friendly, modern, educational aesthetic
- Clean and uncluttered
- Mathematically accurate representation
- Professional yet approachable

CRITICAL REQUIREMENTS:
- NO text, NO characters, NO labels, NO numbers (unless this is an algebra-specific topic that requires minimal text)
- NO complex equations or formulas
- NO photorealistic elements
- Focus on DIRECT, CONCRETE representation of "{subtopic}" - NO abstract art
- Must be mathematically accurate for the concept
- Show ONLY what is relevant to "{subtopic}" """

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
        orientation_desc = "LANDSCAPE" if config['width'] > config['height'] else "PORTRAIT"
        prompt = f"""Create a 3D rendered illustration showing ONLY the Tutero AI robot character in a scene related to {context}. 
        
        CRITICAL REQUIREMENTS - MUST FOLLOW:
        1. ASPECT RATIO: The image MUST be exactly {config['aspect_ratio']} aspect ratio ({config['width']}x{config['height']} pixels) - {orientation_desc} orientation. This is NON-NEGOTIABLE.
        2. CHARACTER ACCURACY: The character's HEAD and FACE must be 100% VISIBLE and UNCHANGED.
        
        Character Rules (COPY EXACTLY from reference images):
        - **NO HEADWEAR**: ABSOLUTELY NO headbands, sweatbands, rings, hats, or helmets on the character's head. The head must be exactly as shown in reference images.
        - **NO WINTER GEAR**: ABSOLUTELY NO beanies, wool hats, scarves, puffer jackets, or winter coats. This is a STRICT PROHIBITION unless the context is literally "Snow" or "Skiing".
        - THIS IMAGE SHOWS ONLY THE TUTERO AI CHARACTER - NO STUDENTS OR OTHER PEOPLE
        - Use the EXACT character design shown in the reference images
        - EXACT body shape, colors, facial features, and all design details
        - **THE TIE IS MANDATORY**: The character MUST wear the EXACT TIE shown in the reference images. It is a non-negotiable part of the identity.
        - **TIE STABILITY**: The tie must be NEATLY TIED and resting FLAT against the character's body. It must NOT be flying, flapping, or floating, even if the character is moving.
        - **IDENTITY IS PARAMOUNT**: The character must be instantly recognizable as the Tutero AI robot.
        - **NO UNNECESSARY GEAR**: Prefer the robot's NATURAL appearance (EXACTLY as shown in reference images) unless the context *strictly* requires a uniform (like a sports team).
        - **POSITIVE ACTION ONLY**: No aggressive tackling, no jumping ON other players, no violent contact. Action must be skillful, safe, and positive.
        - **NO HELMETS** unless specifically requested or absolutely required for safety in the context (e.g., construction site). Even then, the face must be visible.
        - **NO JERSEYS** unless the context is a specific team sport (e.g., NFL, Basketball, AFL). For generic activities (running, jumping), use the natural robot body.
        - **DO NOT** replace the robot's head with a generic helmet. The helmet must sit ON TOP of the robot's head or have a clear visor showing the robot's face.
        - The robot's specific "glasses" and eye shape must be visible and accurate.
        - The character from the reference images is the ONLY character in this image (unless it's a net sport opponent)
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
        - If context is "Basketball": Character on a court holding a ball (Jersey is optional, prefer natural robot body if possible)
        - If context is "NFL": Character on a field holding a football (Jersey is okay, but NO HELMET unless critical)
        - If context is "Skiing": Character on skis (NO goggles, NO helmet - keep face visible)
        - If context is "Running": Natural robot body running (NO track suit, NO headband)
        - **TABLE TENNIS / PING PONG**:
          *   **NO WINTER CLOTHES**: The character must NOT wear jackets, hats, or beanies. Use the natural robot body.
          *   **EQUIPMENT**: Paddle in hand, ping pong ball.
        - **TENNIS**:
          *   **NO WINTER CLOTHES**: ABSOLUTELY NO jackets, beanies, or scarves. Use the natural robot body or a simple tennis shirt.
          *   **ACTION**: Hitting the ball over the net.
        - **AFL (Australian Football)**:
          *   **GOAL POSTS**: OPTIONAL. Prefer NOT showing posts unless necessary.
          *   **POST ACCURACY**: If shown, they must be TWO SEPARATE VERTICAL POLES. **ABSOLUTELY NO CROSSBARS** (this is not Rugby). **NO NETS**.
          *   **POST PLACEMENT**: Must be at the very EDGE of the stadium in the background.
          *   **BALL**: Red oval ball (Sherrin).
          *   **NO PADDING**: No heavy padding or helmets.
        - **NET SPORTS (Tennis, Volleyball, Badminton)**:
          *   **CAMERA ANGLE**: Use a **SIDE PROFILE** view for action shots. The camera should be positioned on the sideline, seeing the character in profile.
          *   **GAZE DIRECTION**: The character must be LOOKING AT the ball/shuttlecock. **NEVER** let the character make eye contact with the camera during gameplay.
          *   **ACTION SHOTS**: If hitting the ball, the character must be facing the NET, not the camera.
          *   **SWING DIRECTION**: The racket/arm must be swinging TOWARDS the net/opponent.
          *   **OPPONENT ALLOWED**: It is acceptable to show a second Tutero AI character on the other side of the net.
          *   **NET PLACEMENT**: For side views, the net should be visible in the middle or side of the frame, perpendicular to the camera angle.
        
        **GLOBAL LOGICAL ACCURACY RULES**:
        - **PHYSICAL SENSE**: All objects must be in their logical places (e.g., goal posts at the END of the field, not the middle).
        - **NO IMPOSSIBLE GEOMETRY**: Do not merge objects or have them floating without reason.
        - **CONTEXT FIDELITY**: The environment must follow the real-world rules of the sport/activity.
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
        - **PRESERVE FACIAL FEATURES**: The robot's eyes and glasses MUST be visible and accurate, even if wearing a helmet.
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
        
        orientation_desc = "LANDSCAPE" if config['width'] > config['height'] else "PORTRAIT"
        prompt = f"""Create a vibrant, illustrated scene showing the Tutero AI robot character physically present and helping diverse students with {activity} in a modern classroom setting.

CRITICAL REQUIREMENTS - MUST FOLLOW:
1. ASPECT RATIO: The image MUST be exactly {config['aspect_ratio']} aspect ratio ({config['width']}x{config['height']} pixels) - {orientation_desc} orientation. This is NON-NEGOTIABLE.
2. CHARACTER DESIGN: Match the reference images EXACTLY for the Tutero AI character design.

Tutero AI Character (COPY EXACTLY from reference images):
- **HEAD APPEARANCE**: The robot has a SMOOTH, GRADIENT-COLORED DOME head with a small antenna on top.
- **FOREHEAD MUST BE CLEAR**: The forehead area above the glasses must be completely clean and empty.
- **STRICT PROHIBITION**: REMOVE any black bands, sweatbands, rings, or lines around the head. The head surface is continuous and smooth.
- THE TUTERO AI CHARACTER MUST BE PHYSICALLY PRESENT IN THE SCENE
- Use the EXACT character design shown in the reference images
- DO NOT modify the character's appearance - copy it exactly
- EXACT body shape, colors, facial features, and all design details from reference images
- Physically present in the 3D space, NOT on a tablet, screen, or digital device
- **GROUNDED POSITION**: The character must be SITTING on a chair or STANDING on the floor. **ABSOLUTELY NO FLOATING** or hovering in mid-air.
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
- **NO HEADBANDS/RINGS**: The robot's head is a smooth dome. DELETE any black bands or rings around the forehead.
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
        style = kwargs.get('style', 'realistic')
        orientation_desc = "LANDSCAPE" if config['width'] > config['height'] else "PORTRAIT"
        
        # COMMON STRICT CONSTRAINTS (Applies to ALL styles)
        strict_constraints = """
        CRITICAL - ZERO TOLERANCE RULES:
        1. NO MATHEMATICAL ELEMENTS: ABSOLUTELY NO numbers, NO equations, NO formulas, NO graphs, NO charts, NO diagrams.
        2. NO GEOMETRIC OVERLAYS: ABSOLUTELY NO lines, NO curves, NO projectiles, NO dotted lines, NO arrows, NO grids.
        3. NO TEXT: ABSOLUTELY NO words, NO letters, NO labels, NO speech bubbles, NO captions.
        4. ACCURACY: The image must ONLY show details relevant to the context: "{context}". Do NOT add generic elements from other contexts.
        5. NO EDUCATIONAL DIAGRAMS: This is a SCENE, not a textbook diagram.
        """

        if style == 'cartoon':
            prompt = f"""Create a vivid, high-quality 3D ANIMATION STYLE illustration of {context}.
            
            Aspect ratio {config['aspect_ratio']} ({config['width']}x{config['height']}) - {orientation_desc} orientation.
            
            {strict_constraints}
            
            Visual Style (CARTOON / 3D ANIMATION):
            - High-end 3D animated movie aesthetic (Pixar/Disney/Dreamworks quality)
            - Vibrant, expressive colors and lighting
            - Soft, appealing textures and clay-like rendering
            - Clean, stylized shapes with smooth edges
            - Cinematic composition typical of modern animated films
            - LOOKS LIKE A STILL FROM A FEATURE ANIMATED MOVIE
            
            Context Scene ({context}):
            - Show a stylized but RECOGNIZABLE representation of: {context}
            - Focus on the SETTING and OBJECTS that define this context
            - If characters are necessary for the context (e.g., "Water Skiing"), they must be stylized characters consistent with the animation style.
            - If the context implies a specific location (e.g., "Airport"), focus on the environment.
            - Atmosphere: Cheerful, inviting, and clear.
            """
        else: # default to realistic
            prompt = f"""Create a cinematic, photorealistic image capturing a real-world scene of {context}.
            
            Aspect ratio {config['aspect_ratio']} ({config['width']}x{config['height']}) - {orientation_desc} orientation.
            
            {strict_constraints}
            
            Visual Style (REALISTIC / CINEMATIC):
            - Photorealistic, 8k resolution, highly detailed
            - Cinematic lighting and composition
            - Natural color palette
            - LOOKS LIKE A PROFESSIONAL PHOTOGRAPH or HIGH-END MOVIE STILL
            - NOT an illustration, NOT a sketch, NOT a painting.
            
            Context Scene ({context}):
            - Real-world scenario: {context}
            - Setting: Immersive, realistic environment appropriate to the context
            - Elements: ONLY physical, real-world objects found in this setting. 
            - Atmosphere: Natural lighting, atmospheric depth, photorealistic textures.
            """

        # Common negative prompt
        prompt += """
        
        NEGATIVE PROMPT (STRICT):
        text, writing, words, letters, alphabet, numbers, digits, equations, formulas, math symbols, 
        plus sign, minus sign, equals sign, x, y, variables, 
        diagram, infographic, chart, graph, plot, grid, axis, coordinates, 
        lines, dotted lines, dashed lines, arrows, pointers, labels, annotations, 
        projectiles, trajectory paths, geometric shapes overlay, 
        watermark, signature, logo, brand name, trademark, 
        blurry, low quality, distorted, bad anatomy, deformed, 
        mixed context, irrelevant objects, generic crowd, random people.
        """
        
        return prompt
```
