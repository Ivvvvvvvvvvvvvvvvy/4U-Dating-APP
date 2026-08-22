import { z } from 'zod';

import { jsonValueSchema, type JsonValue } from './json.js';

export const profileStatusSchema = z.enum([
  'DRAFT',
  'REVIEWING',
  'RECOMMENDABLE',
  'PAUSED',
  'REJECTED',
  'BANNED',
  'DELETED',
]);

export type ProfileStatus = z.infer<typeof profileStatusSchema>;

export const profileDataSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  profileStatus: profileStatusSchema.default('DRAFT'),
  birthDate: z.iso.date().optional(),
  city: z.string().trim().min(1).max(120).optional(),
  occupation: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(2_000).optional(),
  relationshipGoal: z.string().trim().max(80).optional(),
  mbti: z.string().trim().max(16).optional(),
  zodiac: z.string().trim().max(24).optional(),
  interests: z.array(z.string().trim().min(1).max(80)).max(64).default([]),
  photos: z.array(z.object({
    id: z.string().trim().min(1).max(160),
    url: z.string().url(),
    alt: z.string().trim().max(500),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })).max(12).default([]),
  prompts: z.array(z.object({
    prompt: z.string().trim().min(1).max(300),
    answer: z.string().trim().min(1).max(2_000),
  })).max(12).default([]),
  verification: z.object({
    account: z.string().trim().min(1).max(32),
    personhood: z.string().trim().min(1).max(32),
    profileReview: z.string().trim().min(1).max(32),
  }).optional(),
  attributes: z.record(z.string(), jsonValueSchema).default({}),
});

/** Fields a user may update directly. Moderation and verification stay server-owned. */
export const selfServiceProfileDataSchema = profileDataSchema.omit({
  profileStatus: true,
  verification: true,
});

export type ProfileData = z.infer<typeof profileDataSchema>;
export type SelfServiceProfileData = z.infer<typeof selfServiceProfileDataSchema>;

export interface ProfileRecord {
  userId: string;
  version: number;
  data: ProfileData;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileUpsertInput {
  userId: string;
  actorUserId?: string;
  expectedVersion: number;
  idempotencyKey: string;
  data: ProfileData;
  metadata?: Record<string, JsonValue>;
}
