import { SarvamAIClient } from "sarvamai";

const apiKey = process.env.SARVAM_API_KEY;

if (!apiKey) {
  throw new Error("SARVAM_API_KEY is missing from .env");
}

const client = new SarvamAIClient({ apiSubscriptionKey: apiKey });
const response = await client.chat.completions({
  model: "sarvam-105b-conversations",
  messages: [
    {
      role: "user",
      content: "Reply with one short sentence confirming the Kimbo API connection works.",
    },
  ],
  reasoning_effort: null,
  max_tokens: 64,
});

const reply = response.choices[0]?.message.content;

if (!reply) {
  throw new Error("Sarvam returned no reply");
}

console.log(reply);
