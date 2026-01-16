/**
 * Converts an image URL to a base64 data URL.
 * @param url The URL of the image to convert.
 * @returns A promise that resolves to a data URL string.
 */
async function urlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image from ${url}: ${response.statusText}`,
    );
  }
  const blob = await response.blob();
  const mimeType = blob.type;

  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl);
    };
    reader.onerror = (err) => {
      reject(err);
    };
    reader.readAsDataURL(blob);
  });

  return base64Data;
}

/**
 * Generates an image using OpenRouter's Gemini API based on a prompt and style guide images.
 * @param prompt The user's text prompt describing the desired image.
 * @param imageUrls An array of URLs for the style guide images.
 * @returns A promise that resolves to the base64 data URL of the generated image.
 */
export const generateImage = async (
  prompt: string,
  imageUrls: string[],
): Promise<string> => {
  const apiKey = process.env.API_KEY;
  console.log("🔑 API Key being used:", apiKey);
  if (!apiKey) {
    throw new Error("API_KEY environment variable is not set.");
  }

  // Convert image URLs to data URLs
  const imageDataUrls = await Promise.all(imageUrls.map(urlToDataUrl));

  // Build the content array with images and text
  const fullPrompt = `Using the provided images as a strict style reference for mathematical diagrams, generate a new image based on the following request: "${prompt}"`;

  const content = [
    ...imageDataUrls.map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    })),
    {
      type: "text" as const,
      text: fullPrompt,
    },
  ];

  // Call OpenRouter API
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://tutero.com.au",
        "X-Title": "Math Image Stylizer AI",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: content,
          },
        ],
        modalities: ["image", "text"],
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log("📦 OpenRouter Response:", data);

  // Extract the generated image
  const message = data.choices?.[0]?.message;
  if (message?.images && message.images.length > 0) {
    const imageUrl = message.images[0].image_url?.url;
    if (imageUrl) {
      return imageUrl;
    }
  }

  throw new Error(
    "No image was generated. The model may have refused the request.",
  );
};
