import awsLambdaFastify from "@fastify/aws-lambda";

import { parseEnv } from "../config/env.js";
import { buildProductionApp } from "../production-app.js";

/** Lambda entry for the HTTP API (behind a Lambda Function URL). Same Fastify app as `npm run dev`. */
const app = await buildProductionApp(parseEnv(process.env));
// Respond as soon as the handler resolves instead of waiting for idle Postgres sockets to close.
export const handler = awsLambdaFastify(app, { callbackWaitsForEmptyEventLoop: false });
await app.ready();
