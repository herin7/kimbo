export const foodAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "overallConfidence", "warnings"],
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "portion", "nutrition", "confidence"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 },
          portion: {
            type: "object",
            additionalProperties: false,
            required: ["amount", "unit", "displayText"],
            properties: {
              amount: { type: "number", exclusiveMinimum: 0 },
              unit: { type: "string", minLength: 1, maxLength: 32 },
              displayText: { type: "string", minLength: 1, maxLength: 80 },
            },
          },
          nutrition: {
            type: "object",
            additionalProperties: false,
            required: ["calories", "proteinGrams", "carbsGrams", "fatGrams"],
            properties: {
              calories: { type: "number", minimum: 0 },
              proteinGrams: { type: "number", minimum: 0 },
              carbsGrams: { type: "number", minimum: 0 },
              fatGrams: { type: "number", minimum: 0 },
            },
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
    overallConfidence: { type: "number", minimum: 0, maximum: 1 },
    warnings: {
      type: "array",
      maxItems: 5,
      items: { type: "string", minLength: 1, maxLength: 240 },
    },
  },
} as const;
