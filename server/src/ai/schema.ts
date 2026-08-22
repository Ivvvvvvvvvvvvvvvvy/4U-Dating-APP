import { z } from 'zod';
import { EXPLANATION_DIMENSIONS } from './types.js';

const evidenceIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/);
const conclusionIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/);

export const generatedRationaleSchema = z.object({
  conclusionId: conclusionIdSchema,
  dimension: z.enum(EXPLANATION_DIMENSIONS),
  title: z.string().trim().min(1).max(40),
  detail: z.string().trim().min(1).max(180),
  evidenceIds: z.array(evidenceIdSchema).min(1).max(6),
}).strict();

export const generatedUncertaintySchema = z.object({
  text: z.string().trim().min(1).max(120),
  evidenceIds: z.array(evidenceIdSchema).min(1).max(4),
}).strict();

export const generatedExplanationSchema = z.object({
  schemaVersion: z.literal('1.0'),
  headline: z.string().trim().min(1).max(60),
  summary: z.string().trim().min(1).max(240),
  rationales: z.array(generatedRationaleSchema).min(1).max(3),
  uncertainty: generatedUncertaintySchema.nullable(),
}).strict();

export type GeneratedExplanation = z.infer<typeof generatedExplanationSchema>;

/** JSON Schema sent verbatim through Responses API `text.format`. */
export const GENERATED_EXPLANATION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'headline', 'summary', 'rationales', 'uncertainty'],
  properties: {
    schemaVersion: { type: 'string', const: '1.0' },
    headline: { type: 'string', minLength: 1, maxLength: 60 },
    summary: { type: 'string', minLength: 1, maxLength: 240 },
    rationales: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['conclusionId', 'dimension', 'title', 'detail', 'evidenceIds'],
        properties: {
          conclusionId: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$' },
          dimension: { type: 'string', enum: [...EXPLANATION_DIMENSIONS] },
          title: { type: 'string', minLength: 1, maxLength: 40 },
          detail: { type: 'string', minLength: 1, maxLength: 180 },
          evidenceIds: {
            type: 'array',
            minItems: 1,
            maxItems: 6,
            items: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$' },
          },
        },
      },
    },
    uncertainty: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'evidenceIds'],
          properties: {
            text: { type: 'string', minLength: 1, maxLength: 120 },
            evidenceIds: {
              type: 'array',
              minItems: 1,
              maxItems: 4,
              items: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$' },
            },
          },
        },
      ],
    },
  },
} as const;
