import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { canonicalPairKey, canonicalizeUserIds } from '../recommendations/pair.js';
import { profileDataSchema } from '../types/profile.js';
import { jsonObjectSchema } from '../types/json.js';
import type {
  ConversationView, ExpressHeartInput, HeartMutationReceipt, HeartView, MatchView,
  RelationshipMutationReceipt, RelationshipRepositoryOptions, UnmatchInput,
  UnmatchReceipt, WithdrawHeartInput,
} from '../types/relationship.js';
import {
  IdempotencyConflictError, InvariantViolationError, NotFoundError,
  RelationshipStateConflictError, ValidationError, VersionConflictError,
} from './errors.js';
import { EventStore } from './events.js';
import type { Database, SqlExecutor } from './pool.js';
import { hashJson, isoTimestamp, toJsonObject } from './util.js';

const DEFAULT_HEART_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const userIdSchema = z.string().trim().min(1).max(200);
const idempotencyKeySchema = z.string().trim().min(8).max(255);
const versionSchema = z.number().int().nonnegative();

const heartInputSchema = z.object({
  actorUserId: userIdSchema, targetUserId: userIdSchema, expectedVersion: versionSchema,
  idempotencyKey: idempotencyKeySchema, metadata: jsonObjectSchema.optional(),
});
const unmatchInputSchema = z.object({
  actorUserId: userIdSchema, matchId: z.string().trim().min(1).max(200),
  expectedVersion: versionSchema, idempotencyKey: idempotencyKeySchema,
  metadata: jsonObjectSchema.optional(),
});

type HeartRow = { actor_user_id: string; target_user_id: string; pair_key: string; version: string; status: HeartView['status']; expressed_at: Date | string; expires_at: Date | string; withdrawn_at: Date | string | null; updated_at: Date | string };
type MatchRow = { match_id: string; pair_key: string; left_user_id: string; right_user_id: string; version: string; status: MatchView['status']; matched_at: Date | string; updated_at: Date | string };
type ConversationRow = { thread_id: string; match_id: string; pair_key: string; version: string; status: ConversationView['status']; created_at: Date | string; updated_at: Date | string };
type MatchViewRow = MatchRow & { thread_id: string; conversation_version: string; conversation_status: ConversationView['status']; conversation_created_at: Date | string; conversation_updated_at: Date | string };
type CommandRow = { command_id: string; request_hash: string; response: { receipt?: RelationshipMutationReceipt | null } | null };
type CommandReservation =
  | { id: string; replayed: false }
  | { id: string; replayed: true; receipt: RelationshipMutationReceipt | null };

function pair(actorUserId: string, targetUserId: string) {
  if (actorUserId === targetUserId) throw new ValidationError('A user cannot heart themself');
  const [leftUserId, rightUserId] = canonicalizeUserIds(actorUserId, targetUserId);
  return { leftUserId, rightUserId, pairKey: canonicalPairKey(leftUserId, rightUserId) };
}

function mapHeart(row: HeartRow, now: Date): HeartView {
  return {
    actorUserId: row.actor_user_id, targetUserId: row.target_user_id,
    status: row.status === 'ACTIVE' && new Date(row.expires_at) <= now ? 'EXPIRED' : row.status,
    version: Number(row.version), expressedAt: isoTimestamp(row.expressed_at),
    expiresAt: isoTimestamp(row.expires_at),
    withdrawnAt: row.withdrawn_at ? isoTimestamp(row.withdrawn_at) : null,
    updatedAt: isoTimestamp(row.updated_at),
  };
}

function currentTime(now: () => Date): Date {
  const value = now();
  if (!Number.isFinite(value.getTime())) throw new RangeError('now() must return a valid Date');
  return value;
}

function mapMatch(row: MatchViewRow): MatchView {
  return {
    matchId: row.match_id, status: row.status, version: Number(row.version),
    participantUserIds: [row.left_user_id, row.right_user_id],
    matchedAt: isoTimestamp(row.matched_at), updatedAt: isoTimestamp(row.updated_at),
    conversation: { threadId: row.thread_id, matchId: row.match_id,
      status: row.conversation_status, version: Number(row.conversation_version),
      createdAt: isoTimestamp(row.conversation_created_at),
      updatedAt: isoTimestamp(row.conversation_updated_at) },
  };
}

function isAdult(birthDate: string | undefined, now: Date): boolean {
  if (!birthDate) return false;
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!parsed) return false;
  let age = now.getUTCFullYear() - Number(parsed[1]);
  const month = Number(parsed[2]);
  const day = Number(parsed[3]);
  if (now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day)) age--;
  return age >= 18;
}

async function reserveCommand(executor: SqlExecutor, actor: string, key: string, kind: string, requestHash: string): Promise<CommandReservation> {
  const id = randomUUID();
  const inserted = await executor.query("INSERT INTO relationship_commands (actor_user_id,idempotency_key,command_id,command_type,request_hash) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (actor_user_id,idempotency_key) DO NOTHING RETURNING command_id", [actor, key, id, kind, requestHash]);
  if (inserted.rowCount === 1) return { id, replayed: false };
  const existing = await executor.query<CommandRow>("SELECT command_id,request_hash,response FROM relationship_commands WHERE actor_user_id=$1 AND idempotency_key=$2 FOR UPDATE", [actor, key]);
  const row = existing.rows[0];
  if (!row) throw new InvariantViolationError('Relationship command disappeared');
  if (row.request_hash !== requestHash) throw new IdempotencyConflictError(key);
  if (!row.response || !Object.hasOwn(row.response, 'receipt')) {
    throw new InvariantViolationError('Relationship command has no response');
  }
  return {
    id: row.command_id,
    replayed: true,
    receipt: row.response.receipt ? { ...row.response.receipt, replayed: true } : null,
  };
}

async function completeCommand(executor: SqlExecutor, actor: string, key: string, receipt: RelationshipMutationReceipt | null): Promise<void> {
  const result = await executor.query("UPDATE relationship_commands SET response=$3::jsonb,completed_at=clock_timestamp() WHERE actor_user_id=$1 AND idempotency_key=$2 AND response IS NULL", [actor, key, JSON.stringify({ receipt })]);
  if (result.rowCount !== 1) throw new InvariantViolationError('Relationship command could not be completed');
}

async function lockPair(executor: SqlExecutor, left: string, right: string, key: string): Promise<void> {
  await executor.query(
    'SELECT pg_advisory_xact_lock(LEAST(hashtext($1),hashtext($2)),GREATEST(hashtext($1),hashtext($2)))',
    [left, right],
  );
  await executor.query("INSERT INTO relationship_pairs(pair_key,left_user_id,right_user_id) VALUES($1,$2,$3) ON CONFLICT (pair_key) DO NOTHING", [key, left, right]);
  await executor.query("SELECT pair_key FROM relationship_pairs WHERE pair_key=$1 FOR UPDATE", [key]);
}

async function blocked(executor: SqlExecutor, left: string, right: string): Promise<boolean> {
  const result = await executor.query<{ blocked: boolean }>("SELECT EXISTS(SELECT 1 FROM user_blocks WHERE (blocker_user_id=$1 AND blocked_user_id=$2) OR (blocker_user_id=$2 AND blocked_user_id=$1)) blocked", [left, right]);
  return result.rows[0]?.blocked ?? false;
}

async function requireEligible(executor: SqlExecutor, actor: string, target: string, now: Date): Promise<void> {
  const result = await executor.query<{ data: unknown }>(
    'SELECT data FROM profiles WHERE user_id IN ($1,$2) FOR SHARE',
    [actor, target],
  );
  if (result.rows.length !== 2) throw new NotFoundError('Relationship candidate', target);
  for (const row of result.rows) {
    const profile = profileDataSchema.safeParse(row.data);
    if (!profile.success || profile.data.profileStatus !== 'RECOMMENDABLE'
      || profile.data.verification?.account !== 'VERIFIED'
      || profile.data.verification.personhood !== 'VERIFIED'
      || profile.data.verification.profileReview !== 'VERIFIED'
      || !isAdult(profile.data.birthDate, now)) {
      throw new NotFoundError('Relationship candidate', target);
    }
  }
}

const matchSelect = "SELECT m.match_id,m.pair_key,m.left_user_id,m.right_user_id,m.version,m.status,m.matched_at,m.updated_at,c.thread_id,c.version conversation_version,c.status conversation_status,c.created_at conversation_created_at,c.updated_at conversation_updated_at FROM relationship_matches m JOIN relationship_conversations c ON c.match_id=m.match_id";

export class RelationshipRepository {
  readonly #now: () => Date;
  readonly #heartTtlMs: number;

  constructor(private readonly database: Database, options: RelationshipRepositoryOptions = {}) {
    this.#now = options.now ?? (() => new Date());
    this.#heartTtlMs = options.heartTtlMs ?? DEFAULT_HEART_TTL_MS;
    if (!Number.isSafeInteger(this.#heartTtlMs) || this.#heartTtlMs <= 0) {
      throw new RangeError('heartTtlMs must be a positive safe integer');
    }
  }

  expressHeart(rawInput: ExpressHeartInput): Promise<HeartMutationReceipt> {
    const input = heartInputSchema.parse(rawInput);
    const ids = pair(input.actorUserId, input.targetUserId);
    const metadata = toJsonObject(input.metadata ?? {});
    const requestHash = hashJson({
      command: 'EXPRESS_HEART', actorUserId: input.actorUserId,
      targetUserId: input.targetUserId, expectedVersion: input.expectedVersion, metadata,
    });
    return this.database.transaction(async (tx) => {
      const command = await reserveCommand(tx, input.actorUserId, input.idempotencyKey, 'EXPRESS_HEART', requestHash);
      if (command.replayed) {
        if (!command.receipt?.heart) throw new InvariantViolationError('Heart replay has no heart');
        return { ...command.receipt, heart: command.receipt.heart };
      }
      await lockPair(tx, ids.leftUserId, ids.rightUserId, ids.pairKey);
      const now = currentTime(this.#now);
      if (await blocked(tx, ids.leftUserId, ids.rightUserId)) throw new NotFoundError('Relationship candidate', input.targetUserId);
      await requireEligible(tx, input.actorUserId, input.targetUserId, now);
      const currentResult = await tx.query<HeartRow>('SELECT * FROM relationship_hearts WHERE actor_user_id=$1 AND target_user_id=$2', [input.actorUserId, input.targetUserId]);
      const current = currentResult.rows[0];
      const actualVersion = current ? Number(current.version) : 0;
      const existingMatchResult = await tx.query<MatchRow>('SELECT * FROM relationship_matches WHERE pair_key=$1', [ids.pairKey]);
      const existingMatch = existingMatchResult.rows[0];
      if (existingMatch && existingMatch.status !== 'ACTIVE') throw new RelationshipStateConflictError('This relationship cannot be matched again');
      if (actualVersion !== input.expectedVersion) throw new VersionConflictError('heart', input.targetUserId, input.expectedVersion, actualVersion);
      const changed = !current || mapHeart(current, now).status !== 'ACTIVE';
      if (changed) {
        await new EventStore(tx).appendBatch({ userId: input.actorUserId, actorUserId: input.actorUserId,
          idempotencyKey: 'rel:' + command.id + ':heart', events: [{ aggregateType: 'heart', aggregateId: input.targetUserId,
            expectedVersion: actualVersion, eventType: actualVersion ? 'heart.renewed' : 'heart.expressed',
            payload: toJsonObject({ targetUserId: input.targetUserId }), metadata, occurredAt: now.toISOString() }] });
        const expires = new Date(now.getTime() + this.#heartTtlMs).toISOString();
        const projected = await tx.query("INSERT INTO relationship_hearts(actor_user_id,target_user_id,pair_key,version,status,expressed_at,expires_at,updated_at) VALUES($1,$2,$3,$4,'ACTIVE',$5,$6,$5) ON CONFLICT(actor_user_id,target_user_id) DO UPDATE SET version=EXCLUDED.version,status='ACTIVE',expressed_at=EXCLUDED.expressed_at,expires_at=EXCLUDED.expires_at,withdrawn_at=NULL,updated_at=EXCLUDED.updated_at WHERE relationship_hearts.version=$7", [input.actorUserId,input.targetUserId,ids.pairKey,actualVersion+1,now.toISOString(),expires,actualVersion]);
        if (projected.rowCount !== 1) {
          throw new InvariantViolationError('Heart projection version diverged');
        }
      }
      const reverse = await tx.query<HeartRow>("SELECT * FROM relationship_hearts WHERE actor_user_id=$1 AND target_user_id=$2 AND status='ACTIVE' AND expires_at>$3", [input.targetUserId,input.actorUserId,now.toISOString()]);
      let createdMatch = false;
      if (reverse.rows[0] && !existingMatch) {
        createdMatch = true;
        const matchId = 'match_' + randomUUID();
        const threadId = 'thread_' + randomUUID();
        for (const owner of [ids.leftUserId, ids.rightUserId]) {
          await new EventStore(tx).appendBatch({ userId: owner, actorUserId: input.actorUserId,
            idempotencyKey: 'rel:' + command.id + ':' + owner, events: [
              { aggregateType:'match',aggregateId:matchId,expectedVersion:0,eventType:'match.created',payload:toJsonObject({matchId,participantUserIds:[ids.leftUserId,ids.rightUserId]}),occurredAt:now.toISOString() },
              { aggregateType:'conversation',aggregateId:threadId,expectedVersion:0,eventType:'conversation.ready',payload:toJsonObject({matchId,threadId}),occurredAt:now.toISOString() },
            ] });
        }
        await tx.query("INSERT INTO relationship_matches(match_id,pair_key,left_user_id,right_user_id,version,status,matched_at,updated_at) VALUES($1,$2,$3,$4,1,'ACTIVE',$5,$5)", [matchId,ids.pairKey,ids.leftUserId,ids.rightUserId,now.toISOString()]);
        await tx.query("INSERT INTO relationship_conversations(thread_id,match_id,pair_key,version,status,created_at,ready_at,updated_at) VALUES($1,$2,$3,1,'READY',$4,$4,$4)", [threadId,matchId,ids.pairKey,now.toISOString()]);
      }
      const heartResult = await tx.query<HeartRow>('SELECT * FROM relationship_hearts WHERE actor_user_id=$1 AND target_user_id=$2', [input.actorUserId,input.targetUserId]);
      const heart = heartResult.rows[0];
      if (!heart) throw new InvariantViolationError('Heart was not persisted');
      const matched = await tx.query<MatchViewRow>(matchSelect + " WHERE m.pair_key=$1 AND m.status='ACTIVE'", [ids.pairKey]);
      const receipt: HeartMutationReceipt = { replayed:false, changed:changed || createdMatch, heart:mapHeart(heart,now), ...(matched.rows[0] ? {match:mapMatch(matched.rows[0])}:{}) };
      await completeCommand(tx,input.actorUserId,input.idempotencyKey,receipt);
      return receipt;
    });
  }

  withdrawHeart(rawInput: WithdrawHeartInput): Promise<HeartMutationReceipt> {
    const input = heartInputSchema.parse(rawInput);
    const ids = pair(input.actorUserId,input.targetUserId);
    const metadata = toJsonObject(input.metadata ?? {});
    const requestHash = hashJson({command:'WITHDRAW_HEART',actorUserId:input.actorUserId,
      targetUserId:input.targetUserId,expectedVersion:input.expectedVersion,metadata});
    return this.database.transaction(async(tx)=>{
      const command=await reserveCommand(tx,input.actorUserId,input.idempotencyKey,'WITHDRAW_HEART',requestHash);
      if(command.replayed){if(!command.receipt?.heart)throw new InvariantViolationError('Heart replay has no heart');return {...command.receipt,heart:command.receipt.heart};}
      await lockPair(tx,ids.leftUserId,ids.rightUserId,ids.pairKey);
      if(await blocked(tx,ids.leftUserId,ids.rightUserId))throw new NotFoundError('Outgoing heart',input.targetUserId);
      const match=await tx.query<MatchRow>('SELECT * FROM relationship_matches WHERE pair_key=$1',[ids.pairKey]);
      if(match.rows[0])throw new RelationshipStateConflictError('A matched heart cannot be withdrawn');
      const found=await tx.query<HeartRow>('SELECT * FROM relationship_hearts WHERE actor_user_id=$1 AND target_user_id=$2',[input.actorUserId,input.targetUserId]);
      const current=found.rows[0]; if(!current)throw new NotFoundError('Outgoing heart',input.targetUserId);
      const actual=Number(current.version); if(actual!==input.expectedVersion)throw new VersionConflictError('heart',input.targetUserId,input.expectedVersion,actual);
      const now=currentTime(this.#now); let heart=current; const changed=current.status!=='WITHDRAWN';
      if(changed){
        await new EventStore(tx).appendBatch({userId:input.actorUserId,actorUserId:input.actorUserId,idempotencyKey:'rel:'+command.id+':heart',events:[{aggregateType:'heart',aggregateId:input.targetUserId,expectedVersion:actual,eventType:'heart.withdrawn',payload:toJsonObject({targetUserId:input.targetUserId}),metadata,occurredAt:now.toISOString()}]});
        const updated=await tx.query<HeartRow>("UPDATE relationship_hearts SET version=$3,status='WITHDRAWN',withdrawn_at=$4,updated_at=$4 WHERE actor_user_id=$1 AND target_user_id=$2 AND version=$5 RETURNING *",[input.actorUserId,input.targetUserId,actual+1,now.toISOString(),actual]);
        if(!updated.rows[0])throw new InvariantViolationError('Heart projection version diverged'); heart=updated.rows[0];
      }
      const receipt:HeartMutationReceipt={replayed:false,changed,heart:mapHeart(heart,now)};
      await completeCommand(tx,input.actorUserId,input.idempotencyKey,receipt); return receipt;
    });
  }

  async getOutgoingHeart(actorUserId:string,targetUserId:string):Promise<HeartView|null>{
    const actor=userIdSchema.parse(actorUserId),target=userIdSchema.parse(targetUserId); pair(actor,target);
    const result=await this.database.query<HeartRow>("SELECT h.* FROM relationship_hearts h WHERE actor_user_id=$1 AND target_user_id=$2 AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_user_id=$1 AND b.blocked_user_id=$2) OR (b.blocker_user_id=$2 AND b.blocked_user_id=$1))",[actor,target]);
    return result.rows[0]?mapHeart(result.rows[0],currentTime(this.#now)):null;
  }

  async listOutgoingHearts(actorUserId:string,options:{limit?:number}={}):Promise<HeartView[]>{
    const actor=userIdSchema.parse(actorUserId),limit=z.number().int().min(1).max(100).parse(options.limit??100);
    const result=await this.database.query<HeartRow>("SELECT h.* FROM relationship_hearts h WHERE actor_user_id=$1 AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_user_id=h.actor_user_id AND b.blocked_user_id=h.target_user_id) OR (b.blocker_user_id=h.target_user_id AND b.blocked_user_id=h.actor_user_id)) ORDER BY updated_at DESC,target_user_id LIMIT $2",[actor,limit]);
    const now=currentTime(this.#now); return result.rows.map(row=>mapHeart(row,now));
  }

  async getMatch(viewerUserId:string,matchId:string):Promise<MatchView|null>{
    const viewer=userIdSchema.parse(viewerUserId),id=z.string().trim().min(1).max(200).parse(matchId);
    const result=await this.database.query<MatchViewRow>(matchSelect+" WHERE m.match_id=$1 AND m.status='ACTIVE' AND $2 IN(m.left_user_id,m.right_user_id) AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_user_id=m.left_user_id AND b.blocked_user_id=m.right_user_id) OR (b.blocker_user_id=m.right_user_id AND b.blocked_user_id=m.left_user_id))",[id,viewer]);
    return result.rows[0]?mapMatch(result.rows[0]):null;
  }

  async listMatches(viewerUserId:string,options:{limit?:number}={}):Promise<MatchView[]>{
    const viewer=userIdSchema.parse(viewerUserId),limit=z.number().int().min(1).max(100).parse(options.limit??100);
    const result=await this.database.query<MatchViewRow>(matchSelect+" WHERE m.status='ACTIVE' AND $1 IN(m.left_user_id,m.right_user_id) AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_user_id=m.left_user_id AND b.blocked_user_id=m.right_user_id) OR (b.blocker_user_id=m.right_user_id AND b.blocked_user_id=m.left_user_id)) ORDER BY m.matched_at DESC,m.match_id LIMIT $2",[viewer,limit]);
    return result.rows.map(mapMatch);
  }

  unmatch(rawInput:UnmatchInput):Promise<UnmatchReceipt|null>{
    const input=unmatchInputSchema.parse(rawInput);
    const metadata=toJsonObject(input.metadata??{});
    const requestHash=hashJson({command:'UNMATCH',actorUserId:input.actorUserId,
      matchId:input.matchId,expectedVersion:input.expectedVersion,metadata});
    return this.database.transaction(async(tx)=>{
      const command=await reserveCommand(tx,input.actorUserId,input.idempotencyKey,'UNMATCH',requestHash);
      if(command.replayed){if(!command.receipt)return null;if(!command.receipt.match)throw new InvariantViolationError('Unmatch replay has no match');return {...command.receipt,match:command.receipt.match};}
      const found=await tx.query<MatchRow>('SELECT * FROM relationship_matches WHERE match_id=$1 AND $2 IN(left_user_id,right_user_id)',[input.matchId,input.actorUserId]);
      const initial=found.rows[0];
      if(!initial){await completeCommand(tx,input.actorUserId,input.idempotencyKey,null);return null;}
      await lockPair(tx,initial.left_user_id,initial.right_user_id,initial.pair_key);
      const locked=await tx.query<MatchRow>('SELECT * FROM relationship_matches WHERE match_id=$1 AND $2 IN(left_user_id,right_user_id) FOR UPDATE',[input.matchId,input.actorUserId]);
      const match=locked.rows[0]; if(!match){await completeCommand(tx,input.actorUserId,input.idempotencyKey,null);return null;}
      if(match.status!=='ACTIVE')throw new RelationshipStateConflictError('This match is no longer active');
      const actual=Number(match.version); if(actual!==input.expectedVersion)throw new VersionConflictError('match',input.matchId,input.expectedVersion,actual);
      const conversations=await tx.query<ConversationRow>("SELECT * FROM relationship_conversations WHERE match_id=$1 AND status IN('CREATING','READY') FOR UPDATE",[input.matchId]);
      const conversation=conversations.rows[0]; if(!conversation)throw new InvariantViolationError('Active match has no open conversation');
      const now=currentTime(this.#now),at=now.toISOString();
      for(const owner of [match.left_user_id,match.right_user_id]){
        await new EventStore(tx).appendBatch({userId:owner,actorUserId:input.actorUserId,idempotencyKey:'rel:'+command.id+':'+owner,events:[
          {aggregateType:'match',aggregateId:match.match_id,expectedVersion:actual,eventType:'match.unmatched',payload:toJsonObject({matchId:match.match_id}),occurredAt:at},
          {aggregateType:'conversation',aggregateId:conversation.thread_id,expectedVersion:Number(conversation.version),eventType:'conversation.closed',payload:toJsonObject({matchId:match.match_id,threadId:conversation.thread_id}),occurredAt:at},
        ]});
      }
      const updatedMatch=await tx.query<MatchRow>("UPDATE relationship_matches SET version=$2,status='UNMATCHED',unmatched_at=$3,updated_at=$3 WHERE match_id=$1 AND version=$4 AND status='ACTIVE' RETURNING *",[match.match_id,actual+1,at,actual]);
      const updatedConversation=await tx.query<ConversationRow>("UPDATE relationship_conversations SET version=$2,status='CLOSED',closed_at=$3,updated_at=$3 WHERE thread_id=$1 AND version=$4 AND status IN('CREATING','READY') RETURNING *",[conversation.thread_id,Number(conversation.version)+1,at,Number(conversation.version)]);
      const terminal=updatedMatch.rows[0],closed=updatedConversation.rows[0]; if(!terminal||!closed)throw new InvariantViolationError('Unmatch projection diverged');
      const receipt:UnmatchReceipt={replayed:false,changed:true,match:{matchId:terminal.match_id,status:terminal.status,version:Number(terminal.version),participantUserIds:[terminal.left_user_id,terminal.right_user_id],matchedAt:isoTimestamp(terminal.matched_at),updatedAt:isoTimestamp(terminal.updated_at),conversation:{threadId:closed.thread_id,matchId:closed.match_id,status:closed.status,version:Number(closed.version),createdAt:isoTimestamp(closed.created_at),updatedAt:isoTimestamp(closed.updated_at)}}};
      await completeCommand(tx,input.actorUserId,input.idempotencyKey,receipt); return receipt;
    });
  }
}
