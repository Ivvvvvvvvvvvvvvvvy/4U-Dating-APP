import { z } from 'zod';

import { jsonValueSchema, type JsonValue } from './json.js';

export const fieldConsentPolicySchema = z.object({
  fieldId: z.string().trim().min(1).max(200),
  useForEligibility: z.boolean().default(false),
  useForRanking: z.boolean().default(false),
  useForDisplayScore: z.boolean().default(false),
  useForExplanation: z.boolean().default(false),
});

export type FieldConsentPolicy = z.infer<typeof fieldConsentPolicySchema>;

export const consentDataSchema = z.object({
  policyVersion: z.string().trim().min(1).max(120),
  aiCompatibility: z.boolean(),
  publicExplanation: z.boolean(),
  modelTraining: z.boolean().default(false),
  fieldPolicies: z.array(fieldConsentPolicySchema).max(500).default([]),
  privacy: z.object({
    showAge: z.boolean().default(false),
    showZodiac: z.boolean().default(false),
    showInConfirmedParticipantLists: z.boolean().default(false),
    exactLocationSharing: z.literal('CONFIRMED_ACTIVITY_ONLY').default('CONFIRMED_ACTIVITY_ONLY'),
    lockScreenMessagePreview: z.enum(['HIDDEN', 'SENDER_ONLY', 'FULL']).default('HIDDEN'),
  }).default({
    showAge: false,
    showZodiac: false,
    showInConfirmedParticipantLists: false,
    exactLocationSharing: 'CONFIRMED_ACTIVITY_ONLY',
    lockScreenMessagePreview: 'HIDDEN',
  }),
  extensions: z.record(z.string(), jsonValueSchema).default({}),
}).superRefine((consent, context) => {
  if (!consent.aiCompatibility && consent.publicExplanation) {
    context.addIssue({
      code: 'custom',
      path: ['publicExplanation'],
      message: 'Public AI explanations require AI compatibility processing',
    });
  }
  const fieldIds = new Set<string>();
  consent.fieldPolicies.forEach((policy, index) => {
    if (fieldIds.has(policy.fieldId)) {
      context.addIssue({
        code: 'custom',
        path: ['fieldPolicies', index, 'fieldId'],
        message: 'fieldPolicies must have unique fieldId values',
      });
    }
    fieldIds.add(policy.fieldId);
    if (policy.useForExplanation && !policy.useForDisplayScore) {
      context.addIssue({
        code: 'custom',
        path: ['fieldPolicies', index, 'useForExplanation'],
        message: 'Explanation evidence must also be authorized for the displayed score',
      });
    }
  });
});

export type ConsentData = z.infer<typeof consentDataSchema>;

export interface ConsentRecord {
  userId: string;
  version: number;
  data: ConsentData;
  createdAt: string;
  updatedAt: string;
}

export interface ConsentUpsertInput {
  userId: string;
  actorUserId?: string;
  expectedVersion: number;
  idempotencyKey: string;
  data: ConsentData;
  metadata?: Record<string, JsonValue>;
}
