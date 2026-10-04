import { AnalyseTextMealRequestSchema } from "@kimbo/contracts";
import type { FastifyInstance } from "fastify";

import { AppError } from "../../shared/errors/AppError.js";
import type {
  FoodAnalysisProvider,
  TranscriptionProvider,
} from "./FoodAnalysisProvider.js";

const supportedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
type SupportedImageType = (typeof supportedImageTypes)[number];

const isSupportedImageType = (value: string): value is SupportedImageType =>
  supportedImageTypes.some((type) => type === value);

// AI calls cost money per request, so they get a tighter per-IP limit than the global one.
const aiRateLimit = { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } };

export async function registerFoodAnalysisRoutes(
  app: FastifyInstance,
  dependencies: {
    foodAnalysisProvider: FoodAnalysisProvider;
    transcriptionProvider: TranscriptionProvider;
  },
) {
  app.post("/v1/meal-analyses/text", aiRateLimit, async (request) => {
    const input = AnalyseTextMealRequestSchema.parse(request.body);
    return dependencies.foodAnalysisProvider.analyseText(input);
  });

  app.post("/v1/meal-analyses/image", aiRateLimit, async (request) => {
    const image = await request.file({ limits: { fileSize: 3 * 1024 * 1024, files: 1 } });

    if (!image || !isSupportedImageType(image.mimetype)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Upload one JPEG, PNG, or WebP image",
        400,
        false,
      );
    }

    return dependencies.foodAnalysisProvider.analyseImage({
      bytes: await image.toBuffer(),
      mimeType: image.mimetype,
      locale: "en-IN",
    });
  });

  app.post("/v1/meal-transcriptions", aiRateLimit, async (request) => {
    const audio = await request.file({ limits: { fileSize: 15 * 1024 * 1024, files: 1 } });

    if (!audio || (!audio.mimetype.startsWith("audio/") && audio.mimetype !== "video/mp4")) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Upload a supported audio recording",
        400,
        false,
      );
    }

    return dependencies.transcriptionProvider.transcribe({
      bytes: await audio.toBuffer(),
      fileName: audio.filename || "meal-recording.m4a",
      mimeType: audio.mimetype,
    });
  });
}
