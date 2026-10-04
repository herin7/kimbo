// Re-export the native module. On web, it will be resolved to KimboActivityModule.web.ts
// and on native platforms to KimboActivityModule.ts
export { default } from './src/KimboActivityModule';
export * from './src/KimboActivity.types';
