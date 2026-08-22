import { z } from 'zod';
import { selfServiceProfileDataSchema } from '../types/index.js';

const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Json = z.infer<typeof jsonPrimitiveSchema> | Json[] | { [key: string]: Json };
export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([jsonPrimitiveSchema, z.array(jsonSchema), z.record(z.string(), jsonSchema)]),
);
export const jsonObjectSchema = z.record(z.string(), jsonSchema);

export const idempotencyKeySchema = z.string().trim().min(8).max(255);

const clientAggregateTypeSchema = z.string().trim().min(1).max(100)
  .regex(
    /^client_[a-z0-9_]+$/,
    'Client event aggregate types must use the client_ namespace.',
  );

export const personIdSchema = z.string().trim().regex(/^person_[A-Za-z0-9_-]+$/);

export const personParamsSchema = z.object({
  personId: personIdSchema,
}).strict();

export const blockBodySchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
}).strict();

export const blockListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
}).strict();

export const heartBodySchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
}).strict();

export const matchBodySchema = z.object({
  expectedVersion: z.number().int().positive(),
}).strict();

export const matchParamsSchema = z.object({
  matchId: z.string().trim().regex(/^match_[A-Za-z0-9_-]+$/),
}).strict();

export const relationshipListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export const eventsBodySchema = z.object({
  events: z.array(
    z.object({
      eventId: z.string().uuid().optional(),
      // Domain aggregate streams are server-owned. Keeping the public event
      // endpoint in a dedicated namespace prevents clients from advancing
      // profile, consent, heart, match, conversation, or block versions.
      aggregateType: clientAggregateTypeSchema,
      aggregateId: z.string().trim().min(1).max(300),
      expectedVersion: z.number().int().nonnegative(),
      eventType: z.string().trim().min(1).max(160),
      payload: jsonObjectSchema,
      metadata: jsonObjectSchema.optional(),
      occurredAt: z.string().datetime({ offset: true }).optional(),
    }).strict(),
  ).min(1).max(100),
}).strict();

export const eventsQuerySchema = z.object({
  cursor: z.string().regex(/^\d+$/).default('0'),
  limit: z.coerce.number().int().min(1).max(1_000).default(100),
  aggregateType: z.string().trim().min(1).max(100).optional(),
  aggregateId: z.string().trim().min(1).max(300).optional(),
}).strict();

export const profileBodySchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  // Keep the self-service contract fail-closed: moderation and verification
  // fields must be rejected instead of silently stripped from client input.
  profile: selfServiceProfileDataSchema.strict(),
}).strict();

export const aiFieldPolicySchema = z.object({
  fieldId: z.string().trim().min(1).max(128),
  useForEligibility: z.boolean(),
  useForRanking: z.boolean(),
  useForDisplayScore: z.boolean(),
  useForExplanation: z.boolean(),
}).strict().superRefine((policy, context) => {
  if (policy.useForExplanation && !policy.useForDisplayScore) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A field used for explanation must also be allowed for the display score.',
      path: ['useForExplanation'],
    });
  }
});

export const aiConsentBodySchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  aiCompatibility: z.boolean(),
  publicExplanation: z.boolean(),
  fieldPolicies: z.array(aiFieldPolicySchema).max(200).default([]),
}).strict().superRefine((consent, context) => {
  if (!consent.aiCompatibility && consent.publicExplanation) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Public AI explanations require AI compatibility processing.',
      path: ['publicExplanation'],
    });
  }

  const fieldIds = new Set<string>();
  for (const [index, policy] of consent.fieldPolicies.entries()) {
    if (fieldIds.has(policy.fieldId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Field policies must have unique fieldId values.',
        path: ['fieldPolicies', index, 'fieldId'],
      });
    }
    fieldIds.add(policy.fieldId);
  }
});

export const recommendationBodySchema = z.object({
  candidateId: personIdSchema,
  locale: z.string().trim().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).default('zh-CN'),
}).strict();

export const resultParamsSchema = z.object({
  resultId: z.string().trim().min(1).max(128),
}).strict();

export const recommendationFeedbackBodySchema = z.object({
  kind: z.enum(['INACCURATE_REASON', 'UNCOMFORTABLE', 'DO_NOT_USE_MY_FACT', 'NOT_HELPFUL']),
  evidenceId: z.string().trim().min(1).max(128).optional(),
}).strict().superRefine((feedback, context) => {
  if (feedback.kind === 'DO_NOT_USE_MY_FACT' && !feedback.evidenceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'evidenceId is required for DO_NOT_USE_MY_FACT.',
      path: ['evidenceId'],
    });
  }
});
