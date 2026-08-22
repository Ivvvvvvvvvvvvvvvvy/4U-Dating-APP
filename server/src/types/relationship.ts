import { z } from 'zod';

import type { JsonValue } from './json.js';

export const heartStatusSchema = z.enum(['ACTIVE', 'WITHDRAWN', 'EXPIRED']);
export const matchStatusSchema = z.enum(['ACTIVE', 'UNMATCHED', 'BLOCKED']);
export const conversationStatusSchema = z.enum(['CREATING', 'READY', 'CLOSED']);

export type HeartStatus = z.infer<typeof heartStatusSchema>;
export type MatchStatus = z.infer<typeof matchStatusSchema>;
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;

export interface HeartView {
  actorUserId: string;
  targetUserId: string;
  status: HeartStatus;
  version: number;
  expressedAt: string;
  expiresAt: string;
  withdrawnAt: string | null;
  updatedAt: string;
}

export interface ConversationView {
  threadId: string;
  matchId: string;
  status: ConversationStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface MatchView {
  matchId: string;
  status: MatchStatus;
  version: number;
  participantUserIds: readonly [string, string];
  matchedAt: string;
  updatedAt: string;
  conversation: ConversationView;
}

export interface ExpressHeartInput {
  actorUserId: string;
  targetUserId: string;
  expectedVersion: number;
  idempotencyKey: string;
  metadata?: Record<string, JsonValue>;
}

export interface WithdrawHeartInput {
  actorUserId: string;
  targetUserId: string;
  expectedVersion: number;
  idempotencyKey: string;
  metadata?: Record<string, JsonValue>;
}

export interface UnmatchInput {
  actorUserId: string;
  matchId: string;
  expectedVersion: number;
  idempotencyKey: string;
  metadata?: Record<string, JsonValue>;
}

export interface RelationshipMutationReceipt {
  replayed: boolean;
  changed: boolean;
  heart?: HeartView;
  match?: MatchView;
}

export interface HeartMutationReceipt extends RelationshipMutationReceipt {
  heart: HeartView;
}

export interface UnmatchReceipt extends RelationshipMutationReceipt {
  match: MatchView;
}

export interface RelationshipRepositoryOptions {
  now?: () => Date;
  heartTtlMs?: number;
}
