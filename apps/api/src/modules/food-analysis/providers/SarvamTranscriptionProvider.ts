import { SarvamAIClient } from "sarvamai";

import { aiUnavailable, invalidAiResponse } from "../../../shared/errors/AppError.js";
import type { TranscriptionProvider } from "../FoodAnalysisProvider.js";

export class SarvamTranscriptionProvider implements TranscriptionProvider {
  private readonly client: SarvamAIClient;

  constructor(apiKey: string) {
    this.client = new SarvamAIClient({ apiSubscriptionKey: apiKey });
  }

  async transcribe(input: {
    bytes: Buffer;
    fileName: string;
    mimeType: string;
  }): Promise<{ transcript: string; languageCode: string | null }> {
    try {
      const response = await this.client.speechToText.transcribe({
        file: {
          data: input.bytes,
          filename: input.fileName,
          contentType: input.mimeType,
        },
        model: "saaras:v4",
        language_code: "unknown",
      });

      const transcript = response.transcript.trim();
      if (!transcript) throw invalidAiResponse("Empty transcript");

      return {
        transcript,
        languageCode: response.language_code ?? null,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AppError") throw error;
      throw aiUnavailable(error instanceof Error ? error.message : undefined);
    }
  }
}
