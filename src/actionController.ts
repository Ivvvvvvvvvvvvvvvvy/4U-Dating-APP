import { randomId } from './randomId';

export type MutationPhase = 'idle' | 'pending' | 'success' | 'unknown_result' | 'version_conflict' | 'error';

export type MutationReceipt<T> = {
  idempotencyKey: string;
  expectedVersion: number;
  nextVersion: number;
  value: T;
};

export class DemoActionError extends Error {
  constructor(
    public readonly code: 'OFFLINE' | 'VERSION_CONFLICT' | 'UNKNOWN_RESULT',
    public readonly retryable: boolean,
    message: string,
  ) {
    super(message);
  }
}

const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export async function runDemoMutation<T>(options: {
  action: string;
  entityId: string;
  expectedVersion: number;
  currentVersion: number;
  requiresOnline?: boolean;
  commit: () => T;
}): Promise<MutationReceipt<T>> {
  const idempotencyKey = [options.action, options.entityId, randomId()].join(':');
  await delay(360);

  if (options.requiresOnline && !navigator.onLine) {
    throw new DemoActionError('OFFLINE', true, '此操作需要联网后确认');
  }
  if (options.expectedVersion !== options.currentVersion) {
    throw new DemoActionError('VERSION_CONFLICT', true, '状态已变化，请刷新后重新确认');
  }

  return {
    idempotencyKey,
    expectedVersion: options.expectedVersion,
    nextVersion: options.currentVersion + 1,
    value: options.commit(),
  };
}
