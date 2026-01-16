## Ts sdk
```ts
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '<OPENROUTER_API_KEY>',
});

const apiResponse = await client.chat.completions.create({
  model: 'google/gemini-3-pro-image-preview',
  messages: [
    {
      role: 'user' as const,
      content: 'Generate a beautiful sunset over mountains',
    },
  ],
  modalities: ['image', 'text']
});

const response = apiResponse.choices[0].message;
if (response.images) {
  response.images.forEach((image, index) => {
    const imageUrl = image.image_url.url; // Base64 data URL
    console.log(`Generated image ${index + 1}: ${imageUrl.substring(0, 50)}...`);
  });
}
```

## Python
```python
from openai import OpenAI

client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key="<OPENROUTER_API_KEY>",
)

# Generate an image
response = client.chat.completions.create(
  model="google/gemini-3-pro-image-preview",
  messages=[
          {
            "role": "user",
            "content": "Generate a beautiful sunset over mountains"
          }
        ],
  extra_body={"modalities": ["image", "text"]}
)

# The generated image will be in the assistant message
response = response.choices[0].message
if response.images:
  for image in response.images:
    image_url = image['image_url']['url']  # Base64 data URL
    print(f"Generated image: {image_url[:50]}...")
```

## Curl
```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -d '{
  "model": "google/gemini-3-pro-image-preview",
  "messages": [
      {
        "role": "user",
        "content": "Generate a beautiful sunset over mountains"
      }
    ],
  "modalities": ["image", "text"]
  
}'