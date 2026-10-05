import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
  DATABASE_URL: z
    .string()
    .default("postgres://postgres:postgres@127.0.0.1:5432/kimbo"),
  SARVAM_API_KEY: z.string().min(1),
  BEDROCK_REGION: z.string().min(1).default("ap-south-1"),
  BEDROCK_MANTLE_API_KEY: z.string().min(1),
  AI_PROVIDER: z.enum(["real", "mock"]).default("real"),
  API_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export const parseEnv = (environment: NodeJS.ProcessEnv): Env =>
  EnvSchema.parse(environment);
