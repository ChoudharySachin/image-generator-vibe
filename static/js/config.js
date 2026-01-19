export const CONFIG = {
    categories: {
        subtopic_cover: {
            name: "Subtopic Cover Images",
            description: "Cover visuals for educational subtopics",
            aspect_ratio: "16:9",
            width: 1920,
            height: 1080,
            styles: [
                { id: "original", name: "Original", description: "Flat 3D with paper-craft aesthetic", prompt_template: "" },
                {
                    id: "glossy_3d",
                    name: "Glossy 3D",
                    description: "Dark gradient with translucent glass shapes",
                    prompt_template: "Create a minimal glossy 3D illustration. Aspect ratio 16:9 (1920x1080). Rich gradient background transitioning from deep purple to navy blue with subtle grid floor. Translucent glass shapes in warm-cool contrast (magenta, golden yellow, with cyan accents). Glossy reflections and light bloom. Only essential elements. ALL ELEMENTS PERFECTLY CENTERED and floating. Vibrant, modern aesthetic. CRITICAL: NO text, NO characters, NO labels, NO numbers. Mathematically precise geometric representation only."
                },
                {
                    id: "flat_3d",
                    name: "Flat 3D",
                    description: "Soft pastels with paper-craft aesthetic",
                    prompt_template: "Create a minimal flat 3D illustration. Aspect ratio 16:9 (1920x1080). Soft gradient background in pastel tones (light peach to soft lavender). Matte pastel geometric shapes (soft blue, mint green, coral, butter yellow) with subtle shadows. Paper-craft layered aesthetic. Only essential elements. ALL ELEMENTS PERFECTLY CENTERED. Friendly, clean, educational. CRITICAL: NO text, NO characters, NO labels, NO numbers. Mathematically precise."
                },
                {
                    id: "minimal_clean_3d",
                    name: "Minimal Clean 3D",
                    description: "Harmonious colors with subtle lighting",
                    prompt_template: "Create a minimal, clean 3D illustration. Aspect ratio 16:9 (1920x1080). Use only essential elements that directly represent this mathematical concept - nothing extra. Harmonious color palette with 2-3 complementary colors. Soft gradient background in warm tones (cream to soft coral or cool tones like sky blue to mint). ALL ELEMENTS PERFECTLY CENTERED. Modern, professional aesthetic with subtle lighting and shadows. CRITICAL: NO text, NO characters, NO labels, NO numbers. Mathematically accurate geometric representation only."
                },
                {
                    id: "paper_craft",
                    name: "Paper-craft",
                    description: "Flat colors with layer separation",
                    prompt_template: "Create a paper-craft style illustration. Aspect ratio 16:9 (1920x1080). Use flat colors with clear layer separation and subtle drop shadows (4-5 colors). Soft gradient background in gentle pastel tones (light blue to cream or soft pink to peach). Elements should appear as cut paper or cardboard layers that represent the mathematical concept. CENTERED COMPOSITION with depth through layering. Friendly, tactile aesthetic. CRITICAL: NO text, NO labels, NO numbers, NO characters. Precise geometric representation only."
                },
                {
                    id: "watercolor",
                    name: "Watercolor",
                    description: "Soft blended colors with gentle transitions",
                    prompt_template: "Create a watercolor-inspired visualization. Aspect ratio 16:9 (1920x1080). Use soft, blended colors with gentle transitions (watercolor palette: soft blues, pinks, yellows). Colorful textured background with watercolor wash effects (light blues blending into soft pinks or yellows). Elements should blend naturally at edges while maintaining distinct forms that represent the concept. ALL ELEMENTS CENTERED, artistic composition. Gentle, artistic aesthetic. CRITICAL: NO text, NO characters, NO labels, NO numbers. Mathematically accurate representation only."
                },
                {
                    id: "hand_drawn_chalk",
                    name: "Hand-drawn Chalk",
                    description: "Chalk textures on dark slate",
                    prompt_template: "Create a hand-drawn style visualization. Aspect ratio 16:9 (1920x1080). Use chalk-like textures in white, light blue, yellow, and pink on a rich dark slate background (deep charcoal with subtle blue-green tint). Elements should have a slightly rough, educational feel while clearly illustrating the concept. ALL ELEMENTS CENTERED with subtle texture. Classroom-inspired aesthetic. CRITICAL: NO text, NO written equations, NO labels, NO numbers. Mathematically correct geometric representation only."
                },
                {
                    id: "holographic",
                    name: "Holographic",
                    description: "Iridescent gradient with futuristic aesthetic",
                    prompt_template: "Create a holographic style visualization. Aspect ratio 16:9 (1920x1080). Vibrant iridescent gradient background with rainbow shimmer effects (cyan, magenta, yellow, purple transitions). Translucent geometric shapes with prismatic reflections and light refraction. Futuristic, sleek aesthetic with glowing edges. Only essential elements. ALL ELEMENTS PERFECTLY CENTERED and floating. Modern, tech-inspired look. CRITICAL: NO text, NO characters, NO labels, NO numbers. Mathematically precise geometric representation only."
                }
            ]
        },
        tutero_ai: {
            name: "Tutero AI Images",
            description: "AI assistant helping students learn",
            aspect_ratio: "9:16",
            width: 1080,
            height: 1920
        },
        classroom_activity: {
            name: "Classroom Activity Images",
            description: "Students engaged in classroom learning",
            aspect_ratio: "9:16",
            width: 1080,
            height: 1920
        },
        context_introduction: {
            name: "Context Introduction Images",
            description: "Real-world contexts and applications",
            aspect_ratio: "16:9",
            width: 1920,
            height: 1080
        }
    },
    api: {
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        defaultModel: "google/gemini-2.5-flash-image",
        maxRetries: 3,
        retryDelay: 2000
    }
};
