// Bundles the Lambda entry point (plus workspace packages) into one ESM file: dist-lambda/api/index.mjs.
import { build } from "esbuild";
import { rmSync } from "node:fs";

rmSync("dist-lambda", { recursive: true, force: true });
await build({
  entryPoints: ["src/handlers/lambda.ts"],
  outfile: "dist-lambda/api/index.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  // pg tries to load an optional native binding; it isn't installed and isn't needed.
  external: ["pg-native"],
  minifyWhitespace: true,
  minifySyntax: true,
  keepNames: true,
  loader: { ".png": "binary" },
  // Some deps still call require(); give the ESM bundle a working one.
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  logLevel: "warning",
});
console.log("built dist-lambda/api/index.mjs");
