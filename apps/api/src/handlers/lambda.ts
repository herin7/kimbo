import awsLambdaFastify from "@fastify/aws-lambda";

import { parseEnv } from "../config/env.js";
import { buildProductionRuntime } from "../production-app.js";
import { runCoaching } from "../modules/coaching/coaching.job.js";

/** Lambda entry for the HTTP API (behind a Lambda Function URL). Same Fastify app as `npm run dev`. */
const env = parseEnv(process.env);
const runtime = await buildProductionRuntime(env);
const { app } = runtime;
// Respond as soon as the handler resolves instead of waiting for idle Postgres sockets to close.
const httpHandler = awsLambdaFastify(app, { callbackWaitsForEmptyEventLoop: false });
export const handler = async (event: Record<string, unknown>, context: unknown) => {
  if (event.source === "aws.events") return runCoaching(runtime.db, new Date(), env.API_URL ? { apiUrl: env.API_URL } : {});
  return httpHandler(event as never, context as never);
};
await app.ready();
