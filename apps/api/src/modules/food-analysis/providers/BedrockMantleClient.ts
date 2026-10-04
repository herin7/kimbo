import { z } from "zod";

import { aiUnavailable, invalidAiResponse } from "../../../shared/errors/AppError.js";

const BedrockChatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().min(1) }),
      }),
    )
    .min(1),
});

interface ChatMessage {
  role: "system" | "user";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
}

export class BedrockMantleClient {
  constructor(
    private readonly apiKey: string,
    private readonly region: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async createStructuredCompletion(input: {
    model: string;
    messages: ChatMessage[];
    schema: Record<string, unknown>;
    schemaName: string;
    maxTokens: number;
  }): Promise<string> {
    let response: Response;

    try {
      response = await this.fetchImplementation(
        `https://bedrock-mantle.${this.region}.api.aws/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: input.model,
            messages: input.messages,
            max_tokens: input.maxTokens,
            temperature: 0.1,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: input.schemaName,
                strict: true,
                schema: input.schema,
              },
            },
          }),
          signal: AbortSignal.timeout(30_000),
        },
      );
    } catch (error) {
      throw aiUnavailable(error instanceof Error ? error.message : undefined);
    }

    if (!response.ok) {
      const body = (await response.text()).slice(0, 1_000);
      throw aiUnavailable({ status: response.status, body });
    }

    const parsed = BedrockChatResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw invalidAiResponse(parsed.error.flatten());
    }

    const content = parsed.data.choices[0]?.message.content;
    if (!content) throw invalidAiResponse();
    return content;
  }
}
