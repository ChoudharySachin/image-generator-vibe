## Ts sdk
```ts
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '<OPENROUTER_API_KEY>',
});

// First API call with reasoning
const apiResponse = await client.chat.completions.create({
  model: 'google/gemini-3-flash-preview',
  messages: [
    {
      role: 'user' as const,
      content: "How many r's are in the word 'strawberry'?",
    },
  ],
  reasoning: { enabled: true }
});

// Extract the assistant message with reasoning_details
type ORChatMessage = (typeof apiResponse)['choices'][number]['message'] & {
  reasoning_details?: unknown;
};
const response = apiResponse.choices[0].message as ORChatMessage;

// Preserve the assistant message with reasoning_details
const messages = [
  {
    role: 'user' as const,
    content: "How many r's are in the word 'strawberry'?",
  },
  {
    role: 'assistant' as const,
    content: response.content,
    reasoning_details: response.reasoning_details, // Pass back unmodified
  },
  {
    role: 'user' as const,
    content: "Are you sure? Think carefully.",
  },
];

// Second API call - model continues reasoning from where it left off
const response2 = await client.chat.completions.create({
  model: 'google/gemini-3-flash-preview',
  messages, // Includes preserved reasoning_details
});
```

## Python
```python
from openai import OpenAI

client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key="<OPENROUTER_API_KEY>",
)

# First API call with reasoning
response = client.chat.completions.create(
  model="google/gemini-3-flash-preview",
  messages=[
          {
            "role": "user",
            "content": "How many r's are in the word 'strawberry'?"
          }
        ],
  extra_body={"reasoning": {"enabled": True}}
)

# Extract the assistant message with reasoning_details
response = response.choices[0].message

# Preserve the assistant message with reasoning_details
messages = [
  {"role": "user", "content": "How many r's are in the word 'strawberry'?"},
  {
    "role": "assistant",
    "content": response.content,
    "reasoning_details": response.reasoning_details  # Pass back unmodified
  },
  {"role": "user", "content": "Are you sure? Think carefully."}
]

# Second API call - model continues reasoning from where it left off
response2 = client.chat.completions.create(
  model="google/gemini-3-flash-preview",
  messages=messages,
  extra_body={"reasoning": {"enabled": True}}
)
```

## Curl
```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -d '{
  "model": "google/gemini-3-flash-preview",
  "messages": [
    {
      "role": "user",
      "content": "How many r`s are in the word `strawberry?`"
    }
  ],
  "reasoning": {
    "enabled": true
  }
}'
```