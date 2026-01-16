# Kie AI Video Generation Templates

Kie AI provides access to multiple video generation models (Veo, Sora, Kling) through a unified API.

**Required credentials:**
- `KIE_API_KEY` - Get from https://kie.ai

## Ts sdk (Next.js API Route)

```ts
const KIE_API_KEY = process.env.KIE_API_KEY || "";

// Supported models with their API names
const VEO_MODELS: Record<string, string> = {
  "veo3": "veo3",
  "veo3-fast": "veo3_fast",
};

const UNIFIED_MODELS: Record<string, { text: string; image: string }> = {
  "sora-2": {
    text: "sora-2-text-to-video",
    image: "sora-2-image-to-video",
  },
  "kling-2.5": {
    text: "kling/v2-5-turbo-text-to-video-pro",
    image: "kling/v2-5-turbo-image-to-video-pro",
  },
};

/**
 * Generate video using Kie AI's Veo endpoint (Veo 3 models)
 */
async function generateWithVeo(
  prompt: string,
  imageUrl: string | null,
  model: "veo3" | "veo3-fast" = "veo3-fast",
  aspectRatio: "16:9" | "9:16" = "16:9",
  duration: number = 5
): Promise<string> {
  const requestBody: Record<string, unknown> = {
    prompt,
    model: VEO_MODELS[model],
    aspectRatio,
    duration,
    enableTranslation: true,
  };

  if (imageUrl) {
    requestBody.imageUrls = [imageUrl];
    requestBody.generationType = "REFERENCE_2_VIDEO";
  }

  const response = await fetch("https://api.kie.ai/api/v1/veo/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KIE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Kie API error: ${data.msg || response.status}`);
  }

  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(data.msg || "No taskId received");
  }

  // Poll for result
  const taskId = data.data.taskId;
  const maxAttempts = 90;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, 2000));

    const statusResponse = await fetch(
      `https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`,
      { headers: { Authorization: `Bearer ${KIE_API_KEY}` } }
    );

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      const successFlag = statusData.data?.successFlag;

      if (statusData.code === 200 && successFlag === 1) {
        const resultUrls = statusData.data.response?.resultUrls;
        if (resultUrls?.length > 0) {
          return resultUrls[0];
        }
      }

      if (successFlag === 2 || successFlag === 3) {
        throw new Error(statusData.data?.errorMessage || "Generation failed");
      }
    }
  }

  throw new Error("Video generation timed out");
}

/**
 * Generate video using Kie AI's unified endpoint (Sora, Kling)
 */
async function generateWithUnified(
  prompt: string,
  imageUrl: string | null,
  model: "sora-2" | "kling-2.5",
  aspectRatio: "16:9" | "9:16" | "landscape" | "portrait" = "16:9",
  duration: number = 5
): Promise<string> {
  const modelConfig = UNIFIED_MODELS[model];
  const modelName = imageUrl ? modelConfig.image : modelConfig.text;

  let input: Record<string, unknown> = {};

  if (model === "sora-2") {
    input = {
      prompt,
      aspect_ratio: aspectRatio === "9:16" || aspectRatio === "portrait" ? "portrait" : "landscape",
      n_frames: String(duration <= 10 ? 10 : 15),
      remove_watermark: true,
    };
    if (imageUrl) input.image_url = imageUrl;
  } else if (model === "kling-2.5") {
    input = {
      prompt,
      aspect_ratio: aspectRatio === "9:16" || aspectRatio === "portrait" ? "9:16" : "16:9",
      duration: duration <= 5 ? "5" : "10",
      negative_prompt: "blur, distort, low quality",
      cfg_scale: 0.5,
    };
    if (imageUrl) input.image_url = imageUrl;
  }

  const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KIE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: modelName, input }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Kie API error: ${data.message || response.status}`);
  }

  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(data.message || "No taskId received");
  }

  // Poll for result
  const taskId = data.data.taskId;
  const maxAttempts = 150;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, 2000));

    const statusResponse = await fetch(
      `https://api.kie.ai/api/v1/jobs/queryTask?taskId=${taskId}`,
      { headers: { Authorization: `Bearer ${KIE_API_KEY}` } }
    );

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      const state = statusData.data?.state;

      if (statusData.code === 200 && state === "success") {
        const resultJson = statusData.data?.resultJson;
        if (resultJson) {
          const result = typeof resultJson === "string" ? JSON.parse(resultJson) : resultJson;
          const resultUrls = result.resultUrls || [];
          if (resultUrls.length > 0) {
            return resultUrls[0];
          }
        }
      }

      if (state === "fail") {
        throw new Error(statusData.data?.failMsg || "Generation failed");
      }
    }
  }

  throw new Error("Video generation timed out");
}

// Usage example in Next.js API route
export async function POST(request: Request) {
  const { prompt, imageUrl, model, aspectRatio, duration } = await request.json();

  let videoUrl: string;

  if (model === "veo3" || model === "veo3-fast") {
    videoUrl = await generateWithVeo(prompt, imageUrl, model, aspectRatio, duration);
  } else if (model === "sora-2" || model === "kling-2.5") {
    videoUrl = await generateWithUnified(prompt, imageUrl, model, aspectRatio, duration);
  } else {
    throw new Error(`Unsupported model: ${model}`);
  }

  return Response.json({ videoUrl });
}
```

## Image Upload Helper

Kie AI also provides an image upload endpoint for image-to-video workflows:

```ts
/**
 * Upload image to Kie AI's file storage
 * Returns a public URL that can be used for image-to-video generation
 */
async function uploadImageToKie(base64Image: string): Promise<string> {
  const mimeMatch = base64Image.match(/^data:(image\/[a-zA-Z+]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const base64Data = base64Image.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
  const binaryData = Buffer.from(base64Data, "base64");
  const blob = new Blob([binaryData], { type: mimeType });

  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  const ext = extMap[mimeType] || "jpg";
  const fileName = `img-${Date.now()}.${ext}`;

  const formData = new FormData();
  formData.append("file", blob, fileName);
  formData.append("uploadPath", "video-gen-images");
  formData.append("fileName", fileName);

  const response = await fetch("https://kieai.redpandaai.co/api/file-stream-upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${KIE_API_KEY}` },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.success && data.data?.downloadUrl) {
    return data.data.downloadUrl;
  }

  throw new Error("Upload failed: no URL returned");
}
```
