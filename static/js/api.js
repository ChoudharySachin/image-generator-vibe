import { CONFIG } from './config.js';

export class GeminiAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async generateImage(params) {
        const {
            prompt,
            category,
            model,
            width,
            height,
            aspectRatio,
            userReferenceImages = [],
            systemReferenceImages = []
        } = params;

        const effectiveModel = model || CONFIG.api.defaultModel;

        // Build the full content array
        const content = [];

        // Add reference images (both user and system)
        const allReferences = [...systemReferenceImages, ...userReferenceImages];
        for (const url of allReferences) {
            content.push({
                type: "image_url",
                image_url: { url }
            });
        }

        // Build enhanced prompt with reference image instructions
        let enhancedPrompt = '';

        // Add critical instructions if user reference images are provided
        if (userReferenceImages.length > 0) {
            enhancedPrompt += `🚨 ABSOLUTE CRITICAL INSTRUCTION - HIGHEST PRIORITY 🚨\n\n`;

            if (systemReferenceImages.length > 0) {
                enhancedPrompt += `IMAGE ORDER:\n`;
                enhancedPrompt += `- FIRST ${systemReferenceImages.length} image(s): System references for character/style\n`;
                enhancedPrompt += `- LAST ${userReferenceImages.length} image(s): USER REFERENCE IMAGES (MUST MATCH THESE)\n\n`;
            } else {
                enhancedPrompt += `The attached ${userReferenceImages.length} image(s) are USER REFERENCE IMAGES.\n\n`;
            }

            enhancedPrompt += `═══════════════════════════════════════════════════════════\n`;
            enhancedPrompt += `YOUR PRIMARY TASK: CREATE A SIMILAR IMAGE\n`;
            enhancedPrompt += `═══════════════════════════════════════════════════════════\n\n`;

            enhancedPrompt += `The user reference images show EXACTLY what the output should look like.\n`;
            enhancedPrompt += `You are NOT creating something new - you are creating something SIMILAR.\n\n`;

            enhancedPrompt += `MANDATORY REFERENCE GUIDELINES:\n\n`;

            enhancedPrompt += `1. SOURCE OF TRUTH: ELEMENTS & CONTENT (From Reference)\n`;
            enhancedPrompt += `   → EXTRACT the specific math concepts, shapes, diagrams, or patterns from the reference.\n`;
            enhancedPrompt += `   → Maintain the element arrangement and general composition logic.\n`;
            enhancedPrompt += `   → Ensure mathematical accuracy matches the reference.\n\n`;

            enhancedPrompt += `2. SOURCE OF TRUTH: ARTISTIC STYLE (From User Selection/Prompt)\n`;
            enhancedPrompt += `   → APPLY the requested artistic style (e.g., Paper-craft, 3D, Sketch) to the extracted elements.\n`;
            enhancedPrompt += `   → IGNORE the artistic style of the reference image itself (e.g., if reference is a crude sketch but user wants 'Glossy 3D', make it Glossy 3D).\n`;
            enhancedPrompt += `   → Transform the reference content into the target style.\n\n`;

            enhancedPrompt += `3. COMPOSITION & ORIENTATION\n`;
            enhancedPrompt += `   → Adapt the reference elements to fit the requested aspect ratio (Landscape/Portrait).\n`;
            enhancedPrompt += `   → Do not blindly stretch or crop if it ruins the composition; re-arrange elements if needed.\n\n`;

            enhancedPrompt += `4. STRICT CONTENT RULES\n`;
            enhancedPrompt += `   → Only include elements present in or implied by the reference/description.\n`;
            enhancedPrompt += `   → Do NOT add decorative clutter that is not in the style or reference.\n`;



            enhancedPrompt += `⚠️ ABSOLUTE TEXT PROHIBITION:\n`;
            enhancedPrompt += `DO NOT include any text, labels, titles, captions, or written words in the image.\n`;
            enhancedPrompt += `The image must be purely visual. If the reference image contains text/numbers as\n`;
            enhancedPrompt += `part of its design (like a number pattern), you may include similar visual elements,\n`;
            enhancedPrompt += `but do NOT add new text like titles, labels, or descriptions.\n\n`;

            enhancedPrompt += `═══════════════════════════════════════════════════════════\n\n`;
        } else if (systemReferenceImages.length > 0) {
            enhancedPrompt += `REFERENCE IMAGES: The attached images show the exact character design and style you must follow.\n\n`;
        }

        // Add the original prompt
        enhancedPrompt += prompt;

        // Add the text prompt
        content.push({
            type: "text",
            text: enhancedPrompt
        });

        // Determine aspect ratio parameter for API
        const arParam = this._getAspectRatioParam(width, height);

        const payload = {
            model: effectiveModel,
            messages: [
                {
                    role: "user",
                    content: content
                }
            ],
            modalities: ["image", "text"],
            image_config: {
                aspect_ratio: arParam,
                width: width,
                height: height
            }
        };

        const response = await fetch(CONFIG.api.baseUrl, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": window.location.origin,
                "X-Title": "Educational Image Generator"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errorMessage = `API request failed: ${response.status}`;
            try {
                const errorData = await response.json();
                console.error('API Error Response:', errorData);

                // Handle different error formats
                if (errorData.error?.message) {
                    errorMessage = errorData.error.message;
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                } else if (errorData.error) {
                    errorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
                }

                // Provide user-friendly messages for common errors
                if (errorMessage.includes('User not found') || errorMessage.includes('Invalid API key')) {
                    errorMessage = 'Wrong API Key. Enter a valid API Key';
                } else if (errorMessage.includes('insufficient credits') || errorMessage.includes('quota')) {
                    errorMessage = 'Insufficient credits in your OpenRouter account';
                }
            } catch (e) {
                console.error('Failed to parse error response:', e);
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('API Response:', data);

        let imageResponse = data.choices?.[0]?.message?.images?.[0];
        let imageUrl = imageResponse?.image_url?.url;

        // Fallback: Check for markdown image in content
        if (!imageUrl) {
            const content = data.choices?.[0]?.message?.content;
            if (content) {
                const match = content.match(/!\[.*?\]\((.*?)\)/);
                if (match && match[1]) {
                    imageUrl = match[1];
                    console.log('Found image in markdown content:', imageUrl);
                }
            }
        }

        if (!imageUrl) {
            console.error('Unexpected API response structure:', data);

            // Check if there's a text message explanation (e.g., safety refusal)
            const textContent = data.choices?.[0]?.message?.content;
            if (textContent) {
                throw new Error(`Generation failed: ${textContent}`);
            }

            throw new Error("No image generated in API response");
        }

        return imageUrl;
    }

    _getAspectRatioParam(width, height) {
        if (!width || !height) return "1:1";
        const ratio = width / height;
        if (ratio > 1.3) return "16:9";
        if (ratio > 1.1) return "4:3";
        if (ratio > 0.8) return "1:1";
        if (ratio > 0.7) return "3:4";
        if (ratio > 0.6) return "2:3";
        return "9:16";
    }

    async fetchReferenceImages(category) {
        // In a static deployment, we'll try to fetch known reference images from the repo
        // since we don't have a backend to list them.
        // For now, let's assume a few default names as per the repo structure.
        const categoryMap = {
            'subtopic_cover': ['Chalk&Board.png', 'Clean3D.png', 'Glossy3D.png'],
            'tutero_ai': ['TuteroAI.png'],
            'classroom_activity': ['cl1.png', 'cl2.png'],
            'context_introduction': ['rugby_intro.png', 'vol_intro.png']
        };

        const filenames = categoryMap[category] || [];
        const baseDir = `reference_images/${category}/images/`;
        const dataUrls = [];

        for (const filename of filenames) {
            try {
                const response = await fetch(baseDir + filename);
                if (response.ok) {
                    const blob = await response.blob();
                    const dataUrl = await this._blobToDataUrl(blob);
                    dataUrls.push(dataUrl);
                }
            } catch (e) {
                console.warn(`Failed to fetch reference image: ${filename}`, e);
            }
        }

        return dataUrls;
    }

    _blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}
