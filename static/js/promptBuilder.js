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
                const selectedStyle = CONFIG.categories.subtopic_cover?.styles?.find(s => s.id === style);
                if (selectedStyle) {
                    simplifiedPrompt += `STYLE PREFERENCE: ${selectedStyle.name}\n`;
                    if (selectedStyle.prompt_template) {
                        simplifiedPrompt += `${selectedStyle.prompt_template}\n`;
                    }
                    simplifiedPrompt += `\n`;
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
                prompt = this._buildTuteroAIPrompt(userInput, { width, height, aspectRatio });
            } else if (category === 'classroom_activity') {
                prompt = this._buildClassroomPrompt(userInput, { width, height, aspectRatio, age: options.age || 'middle school' });
            } else if (category === 'context_introduction') {
                prompt = this._buildContextPrompt(userInput, { width, height, aspectRatio });
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
        return `Create a 3D rendered illustration showing ONLY the Tutero AI robot character in a scene related to ${context}.
        
CRITICAL REQUIREMENTS:
1. ASPECT RATIO: ${config.aspectRatio} (${config.width}x${config.height}).
2. CHARACTER ACCURACY: The character must look EXACTLY like the reference images.
3. THE TIE IS MANDATORY: The character MUST wear the EXACT TIE shown in reference images.
4. NO PEOPLE: This image shows ONLY the robot character.
`;
    }

    _buildClassroomPrompt(activity, config) {
        return `Create a vibrant scene showing the Tutero AI robot character helping students with ${activity} in a modern classroom.
        
CRITICAL:
1. CHARACTER DESIGN: Match reference images exactly.
2. PHYSICALLY PRESENT: The robot is a character in the scene, not on a screen.
3. DIVERSE STUDENTS: 2-4 diverse students of ${config.age} age.
`;
    }

    _buildContextPrompt(context, config) {
        // Construct orientation description
        const orientationDesc = config.width > config.height ? "LANDSCAPE" : "PORTRAIT";

        return `STRICT INSTRUCTION: GENERATE AN IMAGE. DO NOT CHAT.
SUBJECT: A cinematic, photorealistic real-world scene of ${context}.

Aspect ratio ${config.aspectRatio} (${config.width}x${config.height}) - ${orientationDesc} orientation.

VISUAL REQUIREMENTS (REALISM ONLY):
- Setting: Immersive, realistic environment
- Perspective: Cinematic camera angle
- Elements: ONLY physical objects found in this setting
- Atmosphere: Natural lighting, atmospheric depth
- Style: Photorealistic, 8k resolution, highly detailed photography
- NO "educational" overlays, NO diagrams, NO text

CRITICAL - ZERO TOLERANCE FOR TEXT OR GRAPHS:
- The output must be an image ONLY.
- DO NOT include any text, labels, letters, or numbers in the image.
- DO NOT include any mathematical symbols or equations.
- DO NOT include dashed lines, arrows, or diagram elements.
- DO NOT return a text response answering this prompt. JUST GENERATE THE IMAGE.

NEGATIVE PROMPT: text, writing, words, letters, labels, captions, annotations, infographic, diagram, UI, dotted lines, arrows, math, equations, graphs, charts, watermark, signature, blurry, drawing, sketch, cartoon, illustration
`;
    }
}
