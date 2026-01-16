# Vertex AI Video Generation Templates

Google Vertex AI provides direct access to Veo video generation models.

**Required credentials:**
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account JSON file
- `VERTEX_PROJECT` - Google Cloud project ID
- `VERTEX_LOCATION` - Region (e.g., "us-central1")

## Ts sdk (Next.js API Route)

```ts
import { GoogleAuth } from "google-auth-library";

const VERTEX_PROJECT = process.env.VERTEX_PROJECT || "";
const VERTEX_LOCATION = process.env.VERTEX_LOCATION || "us-central1";

const VEO_MODELS: Record<string, string> = {
  "veo-3-fast": "veo-3.0-fast-generate-001",
  "veo-3-quality": "veo-3.0-generate-001",
  "veo-2": "veo-2.0-generate-001",
};

/**
 * Get OAuth2 access token from service account
 */
async function getAccessToken(): Promise<string> {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS env var not set");
  }

  const auth = new GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  if (!token.token) {
    throw new Error("No token returned from service account");
  }

  return token.token;
}

/**
 * Generate video using Vertex AI Veo
 */
async function generateWithVertexVeo(
  prompt: string,
  base64Image: string | null,
  model: "veo-3-fast" | "veo-3-quality" | "veo-2" = "veo-3-fast",
  aspectRatio: "16:9" | "9:16" = "16:9",
  duration: number = 5
): Promise<string> {
  const modelId = VEO_MODELS[model];
  const accessToken = await getAccessToken();

  // Build instance with optional image
  const instance: Record<string, unknown> = { prompt };

  if (base64Image?.startsWith("data:image/")) {
    const mimeMatch = base64Image.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    if (mimeMatch) {
      instance.image = {
        bytesBase64Encoded: base64Image.replace(/^data:image\/[a-zA-Z+]+;base64,/, ""),
        mimeType: mimeMatch[1],
      };
    }
  }

  // Veo only accepts 4, 6, or 8 second durations
  const validDurations = [4, 6, 8];
  const snappedDuration = validDurations.reduce((prev, curr) =>
    Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
  );

  const endpoint = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${modelId}:predictLongRunning`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [instance],
      parameters: {
        aspectRatio,
        durationSeconds: snappedDuration,
        sampleCount: 1,
      },
    }),
  });

  const operationData = await response.json();
  if (!response.ok) {
    throw new Error(`Vertex AI error: ${operationData.error?.message || response.status}`);
  }

  // Poll for result
  const fullOperationName = operationData.name;
  const pollUrl = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${modelId}:fetchPredictOperation`;

  const maxAttempts = 120;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, 3000));

    const pollResponse = await fetch(pollUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operationName: fullOperationName }),
    });

    const data = await pollResponse.json();

    if (!pollResponse.ok) {
      console.error(`Poll error: ${data.error?.message}`);
      continue;
    }

    if (data.done) {
      if (data.error) throw new Error(data.error.message);

      const videos = data.response?.videos || data.response?.predictions;
      if (videos?.length > 0) {
        const video = videos[0];
        // Return GCS URI, base64, or direct URL
        if (video.gcsUri) return video.gcsUri;
        if (video.bytesBase64Encoded) {
          return `data:${video.mimeType || "video/mp4"};base64,${video.bytesBase64Encoded}`;
        }
        if (video.uri || video.url) return video.uri || video.url;
      }
      throw new Error("No video data in response");
    }
  }

  throw new Error("Video generation timed out");
}

// Usage example in Next.js API route
export async function POST(request: Request) {
  const { prompt, image, model, aspectRatio, duration } = await request.json();

  const videoUrl = await generateWithVertexVeo(
    prompt,
    image,
    model || "veo-3-fast",
    aspectRatio || "16:9",
    duration || 5
  );

  return Response.json({ videoUrl });
}
```

## Service Account Setup

1. Create a service account in Google Cloud Console
2. Grant it the `Vertex AI User` role
3. Download the JSON key file
4. Set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/keyfile.json`

```bash
# .env.local
GOOGLE_APPLICATION_CREDENTIALS=./secrets/service-account.json
VERTEX_PROJECT=your-project-id
VERTEX_LOCATION=us-central1
```

## Dependencies

```bash
npm install google-auth-library
```
