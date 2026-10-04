import { parseEnv } from "./config/env.js";
import { buildProductionApp } from "./production-app.js";

const env = parseEnv(process.env);
const app = await buildProductionApp(env);

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
