import { MealAnalysisResultSchema, type MealAnalysisResult } from "@kimbo/contracts";

import { invalidAiResponse } from "../../../shared/errors/AppError.js";
import type {
  AnalyseFoodImageInput,
  AnalyseFoodTextInput,
  FoodAnalysisProvider,
} from "../FoodAnalysisProvider.js";
import { foodAnalysisJsonSchema } from "../food-analysis.schema.js";
import { BedrockMantleClient } from "./BedrockMantleClient.js";

const SYSTEM_PROMPT = `You estimate foods and nutrition for a personal health log.
Return only the requested structured data. Split distinct foods into separate items.
Nutrition values must represent the entire stated portion, not 100 grams.
Use conservative, realistic estimates. Confidence describes portion certainty, not whether the food exists.
If portion size is unclear, lower confidence and add a concise warning. Never claim medical precision.`;

const parseResult = (raw: string): MealAnalysisResult => {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw invalidAiResponse("Provider output was not JSON");
  }

  const parsed = MealAnalysisResultSchema.safeParse(json);
  if (!parsed.success) {
    throw invalidAiResponse(parsed.error.flatten());
  }

  return parsed.data;
};

export class ProductionFoodAnalysisProvider implements FoodAnalysisProvider {
  constructor(private readonly client: BedrockMantleClient) {}

  async analyseText(input: AnalyseFoodTextInput): Promise<MealAnalysisResult> {
    const raw = await this.client.createStructuredCompletion({
      model: "zai.glm-5",
      maxTokens: 1_200,
      schema: foodAnalysisJsonSchema,
      schemaName: "kimbo_meal_analysis",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Locale: ${input.locale}\nMeal description: ${input.text}`,
        },
      ],
    });

    return parseResult(raw);
  }

  async analyseImage(input: AnalyseFoodImageInput): Promise<MealAnalysisResult> {
    const imageUrl = `data:${input.mimeType};base64,${input.bytes.toString("base64")}`;
    const raw = await this.client.createStructuredCompletion({
      model: "moonshotai.kimi-k2.5",
      maxTokens: 1_200,
      schema: foodAnalysisJsonSchema,
      schemaName: "kimbo_meal_analysis",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Locale: ${input.locale}. Identify the visible foods and estimate their portions.`,
            },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    return parseResult(raw);
  }
}
