import type { FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const artTypes = [
  "protein-behind",
  "calories-fast",
  "steps-behind",
  "back-on-track",
  "goal-achieved",
  "weekly-reflection",
] as const;

const paramsSchema = z.object({ type: z.enum(artTypes) });

async function loadArt(type: (typeof artTypes)[number]) {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const { bundledNotificationArt } = await import("./notification-art.bundle.js");
    return Buffer.from(bundledNotificationArt[type]);
  }

  return readFile(join(process.cwd(), "assets", "notification-art", `${type}.png`));
}

export async function registerNotificationArtRoutes(app: FastifyInstance) {
  app.get("/v1/notification-art/:type.png", async (request, reply) => {
    const { type } = paramsSchema.parse(request.params);
    return reply
      .header("cache-control", "public, max-age=31536000, immutable")
      .type("image/png")
      .send(await loadArt(type));
  });
}
