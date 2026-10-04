import type { MealAnalysisResult } from "@kimbo/contracts";

export interface AnalyseFoodTextInput {
  text: string;
  locale: string;
}

export interface AnalyseFoodImageInput {
  bytes: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  locale: string;
}

export interface FoodAnalysisProvider {
  analyseText(input: AnalyseFoodTextInput): Promise<MealAnalysisResult>;
  analyseImage(input: AnalyseFoodImageInput): Promise<MealAnalysisResult>;
}

export interface TranscriptionProvider {
  transcribe(input: {
    bytes: Buffer;
    fileName: string;
    mimeType: string;
  }): Promise<{ transcript: string; languageCode: string | null }>;
}
