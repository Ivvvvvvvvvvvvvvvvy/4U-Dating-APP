import { ActivityCategory, ActivityFormat, ParticipationMode } from './domain';

export const ACTIVITY_DRAFT_STORAGE_KEY = '4u:rfc:activity-draft';
const ACTIVITY_DRAFT_SCHEMA_VERSION = 1;

export interface ActivityDraftState {
  readonly title: string;
  readonly summary: string;
  readonly category: ActivityCategory;
  readonly format: ActivityFormat;
  readonly participationMode: ParticipationMode;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly city: string;
  readonly district: string;
  readonly areaLabel: string;
  readonly priceInYuan: string;
  readonly capacityMinimum: number;
  readonly capacityMaximum: number;
  readonly agenda: string;
  readonly atmosphereTags: string;
  readonly safetyNotice: string;
}

export type ActivityDraftField =
  | 'title' | 'summary' | 'startsAt' | 'endsAt' | 'city' | 'district' | 'areaLabel'
  | 'capacityMinimum' | 'capacityMaximum' | 'reviewConfirmed';

export type ActivityDraftIssue = {
  readonly field: ActivityDraftField;
  readonly inputId: string;
  readonly message: string;
};

type StoredActivityDraft = {
  readonly schemaVersion: typeof ACTIVITY_DRAFT_SCHEMA_VERSION;
  readonly draftId: string;
  readonly savedAt: string;
  readonly draft: ActivityDraftState;
};

export function createEmptyActivityDraft(): ActivityDraftState {
  return {
    title: '',
    summary: '',
    category: ActivityCategory.EXHIBITION,
    format: ActivityFormat.PAIR,
    participationMode: ParticipationMode.APPLICATION_REQUIRED,
    startsAt: '',
    endsAt: '',
    city: '上海',
    district: '',
    areaLabel: '',
    priceInYuan: '',
    capacityMinimum: 2,
    capacityMaximum: 2,
    agenda: '',
    atmosphereTags: '',
    safetyNotice: '参加不代表表达好感；请在公共场所见面并尊重彼此边界。',
  };
}

export function validateActivityDraftStepOne(draft: ActivityDraftState): ActivityDraftIssue[] {
  const issues: ActivityDraftIssue[] = [];
  if (!draft.title.trim()) issues.push({ field: 'title', inputId: 'activity-title', message: '请填写活动标题' });
  if (!draft.summary.trim()) issues.push({ field: 'summary', inputId: 'activity-summary', message: '请填写活动简介' });
  return issues;
}

export function validateActivityDraftStepTwo(draft: ActivityDraftState, reviewConfirmed: boolean): ActivityDraftIssue[] {
  const issues: ActivityDraftIssue[] = [];
  const startsAt = Date.parse(draft.startsAt);
  const endsAt = Date.parse(draft.endsAt);
  if (!draft.startsAt || !Number.isFinite(startsAt)) issues.push({ field: 'startsAt', inputId: 'activity-starts-at', message: '请选择有效的开始时间' });
  if (!draft.endsAt || !Number.isFinite(endsAt)) issues.push({ field: 'endsAt', inputId: 'activity-ends-at', message: '请选择有效的结束时间' });
  else if (Number.isFinite(startsAt) && endsAt <= startsAt) {
    issues.push({ field: 'endsAt', inputId: 'activity-ends-at', message: '结束时间必须晚于开始时间' });
  }
  if (!draft.city.trim()) issues.push({ field: 'city', inputId: 'activity-city', message: '请填写城市' });
  if (!draft.district.trim()) issues.push({ field: 'district', inputId: 'activity-district', message: '请填写行政区' });
  if (!draft.areaLabel.trim()) issues.push({ field: 'areaLabel', inputId: 'activity-area-label', message: '请填写公开活动区域' });

  if (draft.format === ActivityFormat.PAIR && draft.capacityMinimum !== 2) {
    issues.push({ field: 'capacityMinimum', inputId: 'activity-capacity-minimum', message: '双人同行的最低成行人数必须为 2 人' });
  } else if (draft.format === ActivityFormat.GROUP && (!Number.isInteger(draft.capacityMinimum) || draft.capacityMinimum < 3)) {
    issues.push({ field: 'capacityMinimum', inputId: 'activity-capacity-minimum', message: '多人小组的最低成行人数至少为 3 人' });
  }

  if (draft.format === ActivityFormat.PAIR && draft.capacityMaximum !== 2) {
    issues.push({ field: 'capacityMaximum', inputId: 'activity-capacity-maximum', message: '双人同行的最多参与人数必须为 2 人' });
  } else if (!Number.isInteger(draft.capacityMaximum) || draft.capacityMaximum < draft.capacityMinimum || draft.capacityMaximum > 20) {
    issues.push({ field: 'capacityMaximum', inputId: 'activity-capacity-maximum', message: '最多参与人数应不少于最低人数，且不能超过 20 人' });
  }

  if (!reviewConfirmed) {
    issues.push({ field: 'reviewConfirmed', inputId: 'activity-review-confirmed', message: '请确认公开信息真实且不包含精确集合点或他人隐私' });
  }
  return issues;
}

export function loadActivityDraft(draftId: string): ActivityDraftState {
  return readActivityDraft(draftId) ?? createEmptyActivityDraft();
}

export function hasStoredActivityDraft(): boolean {
  const stored = readStorage();
  if (!stored) return false;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (isStoredEnvelope(parsed)) return Boolean(sanitizeActivityDraft(parsed.draft));
    return Boolean(sanitizeLegacyDraft(parsed));
  } catch {
    return false;
  }
}

export function saveActivityDraft(draftId: string, draft: ActivityDraftState): void {
  const snapshot: StoredActivityDraft = {
    schemaVersion: ACTIVITY_DRAFT_SCHEMA_VERSION,
    draftId,
    savedAt: new Date().toISOString(),
    draft,
  };
  localStorage.setItem(ACTIVITY_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearActivityDraft(draftId: string): void {
  try {
    const stored = readStorage();
    if (!stored) return;
    const parsed: unknown = JSON.parse(stored);
    if (!isStoredEnvelope(parsed) || parsed.draftId === draftId) localStorage.removeItem(ACTIVITY_DRAFT_STORAGE_KEY);
  } catch {
    try { localStorage.removeItem(ACTIVITY_DRAFT_STORAGE_KEY); } catch { /* storage can be unavailable */ }
  }
}

function readActivityDraft(draftId: string): ActivityDraftState | null {
  const stored = readStorage();
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (isStoredEnvelope(parsed)) {
      if (parsed.draftId !== draftId) return null;
      return sanitizeActivityDraft(parsed.draft);
    }
    return sanitizeLegacyDraft(parsed);
  } catch {
    return null;
  }
}

function readStorage() {
  try { return localStorage.getItem(ACTIVITY_DRAFT_STORAGE_KEY); }
  catch { return null; }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStoredEnvelope(value: unknown): value is StoredActivityDraft {
  return isRecord(value)
    && value.schemaVersion === ACTIVITY_DRAFT_SCHEMA_VERSION
    && typeof value.draftId === 'string'
    && typeof value.savedAt === 'string'
    && isRecord(value.draft);
}

function sanitizeLegacyDraft(value: unknown): ActivityDraftState | null {
  if (!isRecord(value)) return null;
  const knownFields = Object.keys(createEmptyActivityDraft());
  if (!knownFields.some((field) => Object.hasOwn(value, field))) return null;
  return sanitizeActivityDraft(value);
}

function sanitizeActivityDraft(value: unknown): ActivityDraftState | null {
  if (!isRecord(value)) return null;
  const defaults = createEmptyActivityDraft();
  const format = enumField(value.format, ActivityFormat, defaults.format);
  const capacityMinimum = numberField(value.capacityMinimum, defaults.capacityMinimum, 2, 20);
  const capacityMaximum = numberField(value.capacityMaximum, defaults.capacityMaximum, 2, 20);
  const normalizedMinimum = format === ActivityFormat.PAIR ? 2 : Math.max(3, capacityMinimum);
  const normalizedMaximum = format === ActivityFormat.PAIR ? 2 : Math.max(normalizedMinimum, capacityMaximum);
  return {
    title: stringField(value.title, defaults.title, 48),
    summary: stringField(value.summary, defaults.summary, 160),
    category: enumField(value.category, ActivityCategory, defaults.category),
    format,
    participationMode: enumField(value.participationMode, ParticipationMode, defaults.participationMode),
    startsAt: dateTimeField(value.startsAt, defaults.startsAt),
    endsAt: dateTimeField(value.endsAt, defaults.endsAt),
    city: nonEmptyStringField(value.city, defaults.city, 40),
    district: stringField(value.district, defaults.district, 60),
    areaLabel: stringField(value.areaLabel, defaults.areaLabel, 100),
    priceInYuan: priceField(value.priceInYuan, defaults.priceInYuan),
    capacityMinimum: normalizedMinimum,
    capacityMaximum: normalizedMaximum,
    agenda: stringField(value.agenda, defaults.agenda, 1000),
    atmosphereTags: stringField(value.atmosphereTags, defaults.atmosphereTags, 200),
    safetyNotice: nonEmptyStringField(value.safetyNotice, defaults.safetyNotice, 500),
  };
}

function stringField(value: unknown, fallback: string, maximumLength: number) {
  return typeof value === 'string' && value.length <= maximumLength ? value : fallback;
}

function nonEmptyStringField(value: unknown, fallback: string, maximumLength: number) {
  return typeof value === 'string' && value.trim() && value.length <= maximumLength ? value : fallback;
}

function dateTimeField(value: unknown, fallback: string) {
  return typeof value === 'string' && (value === '' || (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && Number.isFinite(Date.parse(value)))) ? value : fallback;
}

function priceField(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length <= 12 && /^(?:\d+(?:\.\d{0,2})?)?$/.test(value) ? value : fallback;
}

function numberField(value: unknown, fallback: number, minimum: number, maximum: number) {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function enumField<T extends Record<string, string>>(value: unknown, values: T, fallback: T[keyof T]): T[keyof T] {
  return typeof value === 'string' && Object.values(values).includes(value) ? value as T[keyof T] : fallback;
}
