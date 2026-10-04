import {
  MealAnalysisResultSchema,
  MealTranscriptionResponseSchema,
  type MealAnalysisResult,
  type MealTranscriptionResponse,
} from "@kimbo/contracts";
import { File } from "expo-file-system";

import { apiRequest } from "@/shared/api/api-client";

const jsonHeaders = { "content-type": "application/json" };

export function analyseTextMeal(text: string): Promise<MealAnalysisResult> {
  return apiRequest("/v1/meal-analyses/text", MealAnalysisResultSchema, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ text, locale: "en-IN" }),
  });
}

export async function analyseImageMeal(uri: string, mimeType: string): Promise<MealAnalysisResult> {
  const body = new FormData();
  body.append("file", new File(uri), `meal.${mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg"}`);
  return apiRequest("/v1/meal-analyses/image", MealAnalysisResultSchema, { method: "POST", body }, 60_000);
}

export async function transcribeMeal(uri: string): Promise<MealTranscriptionResponse> {
  const body = new FormData();
  body.append("file", new File(uri), "meal-recording.m4a");
  return apiRequest("/v1/meal-transcriptions", MealTranscriptionResponseSchema, { method: "POST", body }, 60_000);
}
