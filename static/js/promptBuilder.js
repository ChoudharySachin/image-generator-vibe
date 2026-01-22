import { CONFIG } from './config.js';

export class PromptBuilder {
    buildPrompt(category, userInput, options = {}) {
        const categoryConfig = CONFIG.categories[category];
        const {
            width = categoryConfig.width,
            height = categoryConfig.height,
            aspectRatio = categoryConfig.aspect_ratio,
            yearLevel = 'Year 8',
            style = 'original',
            variationIndex,
            totalVariations,
            hasUserReferenceImages = false
        } = options;

        let prompt = '';

        // If user has attached reference images, use a simplified prompt
        // that won't conflict with the reference image matching instructions
        if (hasUserReferenceImages) {
            // Build a minimal prompt that includes critical constraints
            let simplifiedPrompt = `Create an image about: ${userInput}\n\n`;

            // CRITICAL: Always enforce no-text policy
            simplifiedPrompt += `ABSOLUTE RULE: NO TEXT, LABELS, WORDS, OR LETTERS ALLOWED IN THE IMAGE.\n`;
            simplifiedPrompt += `- Do not include any written text, titles, captions, or labels\n`;
            simplifiedPrompt += `- Do not write the subject name or any descriptive words\n`;
            simplifiedPrompt += `- The image must be purely visual with zero text elements\n\n`;

            // Include style preference if specified
            if (style && style !== 'original') {
                // Look up style from the current category, not just subtopic_cover
                const selectedStyle = categoryConfig?.styles?.find(s => s.id === style);
                if (selectedStyle) {
                    simplifiedPrompt += `PRIMARY INSTRUCTION - VISUAL STYLE: ${selectedStyle.name}\n`;
                    if (selectedStyle.prompt_template) {
                        simplifiedPrompt += `${selectedStyle.prompt_template}\n`;
                    }
                    simplifiedPrompt += `This style MUST be applied to ALL elements in the image.\n\n`;
                }
            }

            simplifiedPrompt += `CRITICAL INSTRUCTION FOR REFERENCE IMAGES:\n`;
            simplifiedPrompt += `1. USE THE REFERENCE IMAGE FOR: The mathematical elements, diagrams, shapes, patterns, and content arrangements.\n`;
            simplifiedPrompt += `2. USE THE USER SELECTED STYLE FOR: The artistic look, rendering technique, materials, and overall aesthetic.\n`;
            simplifiedPrompt += `3. DO NOT copy the "style" of the reference image. Apply the "${style}" style to the content shown in the reference.\n`;

            prompt = simplifiedPrompt;
        } else {
            // Use detailed category-specific prompts only when no user references
            if (category === 'subtopic_cover') {
                prompt = this._buildSubtopicPrompt(userInput, { width, height, aspectRatio, yearLevel, style });
            } else if (category === 'tutero_ai') {
                prompt = this._buildTuteroAIPrompt(userInput, { width, height, aspectRatio, style });
            } else if (category === 'classroom_activity') {
                prompt = this._buildClassroomPrompt(userInput, { width, height, aspectRatio, age: options.age || 'middle school', style });
            } else if (category === 'context_introduction') {
                prompt = this._buildContextPrompt(userInput, { width, height, aspectRatio, style });
            }
        }

        if (variationIndex !== undefined && totalVariations > 1) {
            prompt += `\n\nVARIATION INSTRUCTION (${variationIndex + 1}/${totalVariations}):\n`;
            prompt += "Ensure this image has a UNIQUE composition, camera angle, or specific pose compared to other variations.\n";
            // ... truncated variation logic for brevity but keeping the essence
        }

        return prompt;
    }

    _buildSubtopicPrompt(subtopic, config) {
        const { yearLevel, style } = config;
        const selectedStyle = CONFIG.categories.subtopic_cover.styles.find(s => s.id === style);
        let styleTemplate = selectedStyle?.prompt_template || '';

        // Keyword detection logic (simplified version of the Python logic)
        const lowerSubtopic = subtopic.toLowerCase();
        const isAlgebra = /algebra|equation|expression|variable|solve|linear|quadratic|polynomial|factoris|factor|cubic|quartic|expand|division|divid/.test(lowerSubtopic);
        const isTrig = /trigonometry|trig|sine|cosine|tangent|hypotenuse|pythagoras|elevation|depression|bearing|triangle|unit circle|degree|radian/.test(lowerSubtopic);
        // ... more keyword checks ...

        let textWarning = "ABSOLUTELY NO TEXT ALLOWED - ZERO TOLERANCE";
        if (isAlgebra) {
            textWarning = "ABSOLUTELY NO TEXT ALLOWED (with limited algebra exception): Use actual algebraic terms like '3x', '4y'. NO words.";
        }

        const coreContent = `
CRITICAL TASK: Create a minimal, centered illustration representing the mathematical subtopic "${subtopic}" for ${yearLevel} students.
Aspect ratio: ${config.aspectRatio} (${config.width}x${config.height}).


**MATHEMATICAL ACCURACY IS THE #1 PRIORITY**:
- Every element must be a direct, accurate representation of the mathematical concept.
- Minimalism is important, but ACCURACY comes first.

${textWarning}

EXTREME SIMPLICITY:
- Use 1-2 key elements maximum.
- PERFECTLY CENTERED with massive margins (subject takes 15-25% of area).
`;

        return coreContent + (styleTemplate ? `\n\nVISUAL STYLE:\n${styleTemplate}` : '');
    }

    _buildTuteroAIPrompt(context, config) {
        const { style } = config;
        const selectedStyle = CONFIG.categories.tutero_ai.styles?.find(s => s.id === style);
        const styleTemplate = selectedStyle?.prompt_template || '';

        // ALWAYS prioritize style, even for 'original'
        let styleSection = '';
        if (style !== 'original' && styleTemplate) {
            styleSection = `PRIMARY INSTRUCTION - VISUAL STYLE:\n${styleTemplate}\n\nThis style MUST be applied to ALL elements including the character, background, and scene.\n`;
        } else {
            styleSection = 'VISUAL STYLE: Standard 3D character style with clean rendering.\n';
        }

        let characterInstruction = "CHARACTER ACCURACY: The character must look EXACTLY like the reference images.";
        let matchPriority = "THE TIE IS MANDATORY: The character MUST wear the EXACT TIE shown in reference images.";

        if (style !== 'original') {
            characterInstruction = "CHARACTER ADAPTATION (CRITICAL): The character must be FULLY TRANSFORMED to match the PRIMARY INSTRUCTION - VISUAL STYLE above. The character should be recognizable in shape and key features (eyes, antenna, tie) but MUST be completely rendered in the selected style (e.g., if Holographic, the robot MUST be translucent/glowing/prismatic; if Chalk, it must be a chalk drawing on slate; if Watercolor, it must have soft blended colors).";
            matchPriority = "STYLE PRIORITY: The PRIMARY INSTRUCTION - VISUAL STYLE is the MOST IMPORTANT instruction. The reference image is ONLY for the character's basic shape and key identifying features. The ENTIRE IMAGE including the character MUST follow the selected visual style.";
        }

        const core = `
${styleSection}
SUBJECT: The Tutero AI robot character in a scene related to ${context}.

CRITICAL REQUIREMENTS:
1. ASPECT RATIO: ${config.aspectRatio} (${config.width}x${config.height}).
2. ${characterInstruction}
3. ${matchPriority}
4. NO PEOPLE: This image shows ONLY the robot character.
5. ABSOLUTE RULE: NO TEXT, LABELS, WORDS, OR LETTERS in the image.
`;
        return core;
    }

    _buildClassroomPrompt(activity, config) {
        const { style } = config;
        const selectedStyle = CONFIG.categories.classroom_activity.styles?.find(s => s.id === style);
        const styleTemplate = selectedStyle?.prompt_template || '';

        // ALWAYS prioritize style
        let styleSection = '';
        if (style !== 'original' && styleTemplate) {
            styleSection = `PRIMARY INSTRUCTION - VISUAL STYLE:\n${styleTemplate}\n\nThis style MUST be applied to ALL elements including the robot character, students, classroom, and background.\n\n`;
        } else {
            styleSection = 'VISUAL STYLE: Vibrant 3D render with clean, modern aesthetic.\n\n';
        }

        let characterInstruction = "CHARACTER DESIGN: Match reference images exactly.";
        if (style !== 'original') {
            characterInstruction = "CHARACTER DESIGN (CRITICAL): The robot character must be FULLY TRANSFORMED to match the PRIMARY INSTRUCTION - VISUAL STYLE above. The character should be recognizable in shape and key features but MUST be completely rendered in the selected style. Students and classroom elements must also follow the same visual style.";
        }

        const core = `${styleSection}SUBJECT: The Tutero AI robot character helping students with ${activity} in a modern classroom.
        
CRITICAL REQUIREMENTS:
1. ASPECT RATIO: ${config.aspectRatio} (${config.width}x${config.height}).
2. ${characterInstruction}
3. PHYSICALLY PRESENT: The robot is a character in the scene, not on a screen.
4. DIVERSE STUDENTS: 2-4 diverse students of ${config.age} age.
5. STYLE CONSISTENCY: ALL elements (robot, students, classroom) must share the same visual style.
6. ABSOLUTE RULE: NO TEXT, LABELS, WORDS, OR LETTERS in the image.
`;
        return core;
    }

    _buildContextPrompt(context, config) {
        const { width, height, aspectRatio, style } = config;
        const orientationDesc = width > height ? "LANDSCAPE" : "PORTRAIT";

        const selectedStyle = CONFIG.categories.context_introduction.styles?.find(s => s.id === style);
        const isStyleOverride = selectedStyle && selectedStyle.id !== 'original';

        let prompt = `STRICT INSTRUCTION: GENERATE AN IMAGE. DO NOT CHAT.
SUBJECT: A scene of ${context}.

Aspect ratio ${aspectRatio} (${width}x${height}) - ${orientationDesc} orientation.

`;

        // ALWAYS include a prominent style section
        if (isStyleOverride) {
            prompt += `PRIMARY INSTRUCTION - VISUAL STYLE:\n${selectedStyle.prompt_template}\n\nThis style MUST be applied to ALL elements in the scene.\n\n`;
        } else {
            // Default Photorealistic - make it equally prominent
            prompt += `PRIMARY INSTRUCTION - VISUAL STYLE (PHOTOREALISTIC):
- Setting: Immersive, realistic environment
- Perspective: Cinematic camera angle
- Elements: ONLY physical objects found in this setting
- Atmosphere: Natural lighting, atmospheric depth
- Rendering: Photorealistic, 8k resolution, highly detailed photography
- NO "educational" overlays, NO diagrams, NO text

This photorealistic style MUST be applied to ALL elements in the scene.

`;
        }

        // Add context-specific accuracy requirements
        prompt += this._getContextAccuracyRules(context);

        prompt += `CRITICAL - ZERO TOLERANCE FOR TEXT OR GRAPHS:
- The output must be an image ONLY.
- DO NOT include any text, labels, letters, or numbers in the image.
- DO NOT include any mathematical symbols or equations.
- DO NOT include dashed lines, arrows, or diagram elements.
- DO NOT return a text response answering this prompt. JUST GENERATE THE IMAGE.

NEGATIVE PROMPT: text, writing, words, letters, labels, captions, annotations, infographic, diagram, UI, dotted lines, arrows, math, equations, graphs, charts, watermark, signature, blurry, drawing, sketch`;

        if (style === 'original') {
            prompt += `, cartoon, illustration`;
        }

        prompt += `\n`;

        return prompt;
    }

    _getContextAccuracyRules(context) {
        const lowerContext = context.toLowerCase();
        let rules = `\nCONTEXT-SPECIFIC ACCURACY REQUIREMENTS:\n`;

        // Sports contexts
        if (/soccer|football(?! field)|futbol/i.test(lowerContext)) {
            rules += `- SOCCER ACCURACY: Show EXACTLY 2 teams with ONLY 2 distinct jersey colors/designs (one team per jersey type)
- All players on the same team must wear IDENTICAL jerseys
- Typical team colors: solid colors like red vs blue, white vs black, etc.
- Include proper soccer equipment: one soccer ball, goal posts, field markings
- NO mixing of multiple jersey designs on the same team\n`;
        } else if (/basketball/i.test(lowerContext)) {
            rules += `- BASKETBALL ACCURACY: Show EXACTLY 2 teams with ONLY 2 distinct jersey colors
- All players on the same team must wear IDENTICAL jerseys
- Include proper basketball court markings, hoop, and one basketball
- Players should be in realistic basketball poses\n`;
        } else if (/baseball/i.test(lowerContext)) {
            rules += `- BASEBALL ACCURACY: Show EXACTLY 2 teams with ONLY 2 distinct uniform colors
- Include proper baseball equipment: bat, ball, gloves, bases, diamond layout
- Players should wear appropriate protective gear (helmets for batters)\n`;
        } else if (/tennis/i.test(lowerContext)) {
            rules += `- TENNIS ACCURACY: Show 1-2 players (or 2-4 for doubles)
- Include proper tennis court with net, lines, and tennis rackets
- Players should be in realistic tennis poses\n`;
        } else if (/swimming|pool/i.test(lowerContext)) {
            rules += `- SWIMMING ACCURACY: Show swimmers in a pool with proper lane markings
- Include realistic pool environment with clear water
- Swimmers should wear appropriate swimwear and goggles\n`;
        } else if (/rugby/i.test(lowerContext)) {
            rules += `- RUGBY ACCURACY: Show EXACTLY 2 teams with ONLY 2 distinct jersey colors
- All players on the same team must wear IDENTICAL jerseys
- Include proper rugby ball (oval-shaped) and field markings
- Players should be in realistic rugby poses (scrums, tackles, running)\n`;
        }

        // Cooking/Kitchen contexts
        else if (/cooking|baking|kitchen|chef|recipe/i.test(lowerContext)) {
            rules += `- COOKING ACCURACY: Show realistic kitchen environment with appropriate equipment
- Include proper cooking utensils, pots, pans, or baking tools relevant to the activity
- Ingredients should look fresh and realistic
- Kitchen should have proper appliances (stove, oven, etc.) if visible\n`;
        }

        // Science contexts
        else if (/laboratory|lab experiment|science/i.test(lowerContext)) {
            rules += `- LABORATORY ACCURACY: Show realistic lab environment with proper safety equipment
- Include appropriate scientific instruments (beakers, test tubes, microscopes, etc.)
- Scientists/students should wear lab coats and safety goggles when appropriate
- Equipment should be used correctly and realistically\n`;
        }

        // Music contexts
        else if (/music|orchestra|band|concert/i.test(lowerContext)) {
            rules += `- MUSIC ACCURACY: Show realistic musical instruments held and played correctly
- Musicians should be in proper playing positions
- Include appropriate music setting (concert hall, practice room, etc.)
- Instruments should be accurate to their real-world counterparts\n`;
        }

        // Classroom/Education contexts
        else if (/classroom|school|students learning|teacher/i.test(lowerContext)) {
            rules += `- CLASSROOM ACCURACY: Show realistic classroom environment with desks, chairs, and board
- Students should be diverse and engaged in appropriate learning activities
- Include realistic educational materials (books, notebooks, pencils)
- Classroom should have proper lighting and organization\n`;
        }

        // Construction/Building contexts
        else if (/construction|building|architect|engineering/i.test(lowerContext)) {
            rules += `- CONSTRUCTION ACCURACY: Show realistic construction site with proper safety equipment
- Workers should wear hard hats, safety vests, and appropriate gear
- Include realistic construction tools and machinery
- Site should have proper safety measures visible\n`;
        }

        // Transportation contexts
        else if (/traffic|driving|road|highway|transportation/i.test(lowerContext)) {
            rules += `- TRANSPORTATION ACCURACY: Show realistic vehicles with proper road markings
- Traffic should follow logical patterns and rules
- Include appropriate road signs and signals
- Vehicles should be accurate to their real-world models\n`;
        }

        // Nature/Outdoor contexts
        else if (/nature|forest|mountain|beach|outdoor/i.test(lowerContext)) {
            rules += `- NATURE ACCURACY: Show realistic natural environment with appropriate flora and fauna
- Landscape should have proper geological features
- Weather and lighting should be consistent throughout the scene
- Plants and animals should be accurate to the environment\n`;
        }

        // Shopping/Retail contexts
        else if (/shopping|store|retail|supermarket|mall/i.test(lowerContext)) {
            rules += `- RETAIL ACCURACY: Show realistic store environment with proper shelving and products
- Products should be displayed logically and organized
- Include appropriate store fixtures (checkout counters, shopping carts, etc.)
- Customers and staff should be in realistic shopping/working poses\n`;
        }

        // Medical contexts
        else if (/hospital|medical|doctor|nurse|patient/i.test(lowerContext)) {
            rules += `- MEDICAL ACCURACY: Show realistic medical environment with proper equipment
- Medical staff should wear appropriate uniforms and protective gear
- Include accurate medical instruments and furniture
- Setting should be clean, professional, and well-organized\n`;
        }

        // General accuracy rule for all contexts
        rules += `- GENERAL ACCURACY: Ensure all elements in the scene are realistic, properly proportioned, and contextually appropriate
- People should have realistic anatomy, clothing, and poses
- Objects should be used correctly and placed logically
- Lighting and shadows should be consistent throughout the scene
- Colors should be natural and appropriate to the setting\n\n`;

        return rules;
    }
}
