import { useState } from 'react';
import { ArrowLeft, Check, CircleAlert, Eye, FilePenLine, ShieldCheck } from 'lucide-react';
import { ActivityCategory, ActivityFormat, ParticipationMode } from '../domain';

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

export type CreateSubmissionState = 'idle' | 'saving' | 'submitting' | 'submitted' | 'error';

export interface CreateActivityPageProps {
  readonly draftId: string;
  readonly step: 1 | 2;
  readonly draft: ActivityDraftState;
  readonly submissionState?: CreateSubmissionState;
  readonly submissionMessage?: string;
  readonly onDraftChange: (draft: ActivityDraftState) => void;
  readonly onStepChange: (step: 1 | 2) => void;
  readonly onCancel: () => void;
  readonly onSaveDraft?: (draft: ActivityDraftState) => void | Promise<void>;
  readonly onSubmitForReview: (draft: ActivityDraftState) => void | Promise<void>;
}

const categoryOptions = [
  [ActivityCategory.EXHIBITION, '看展'],
  [ActivityCategory.CITY_WALK, '散步'],
  [ActivityCategory.SPORT, '运动'],
  [ActivityCategory.MUSIC, '音乐'],
  [ActivityCategory.FILM, '电影'],
  [ActivityCategory.FOOD, '美食'],
  [ActivityCategory.CRAFT, '手作'],
  [ActivityCategory.OUTDOOR, '户外'],
] as const;

const participationOptions = [
  [ParticipationMode.APPLICATION_REQUIRED, '申请后加入', '由发起者确认，适合需要筛选参与者的活动'],
  [ParticipationMode.OPEN_JOIN, '直接加入', '符合资格即可加入，满员后停止招募'],
  [ParticipationMode.MATCH_FORMATION, '匹配成行', '先表达兴趣，达到条件后再组建活动'],
] as const;

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

export function CreateActivityPage({
  draftId,
  step,
  draft,
  submissionState = 'idle',
  submissionMessage,
  onDraftChange,
  onStepChange,
  onCancel,
  onSaveDraft,
  onSubmitForReview,
}: CreateActivityPageProps) {
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [actionError, setActionError] = useState('');
  const busy = submissionState === 'saving' || submissionState === 'submitting';
  const validStepOne = Boolean(draft.title.trim() && draft.summary.trim());
  const validStepTwo = Boolean(
    draft.startsAt
      && draft.endsAt
      && Date.parse(draft.endsAt) > Date.parse(draft.startsAt)
      && draft.city.trim()
      && draft.district.trim()
      && draft.areaLabel.trim()
      && draft.capacityMinimum >= 2
      && draft.capacityMaximum >= draft.capacityMinimum,
  );

  const update = <K extends keyof ActivityDraftState>(key: K, value: ActivityDraftState[K]) => {
    onDraftChange({ ...draft, [key]: value });
  };

  const selectFormat = (format: ActivityFormat) => {
    onDraftChange({
      ...draft,
      format,
      capacityMinimum: format === ActivityFormat.PAIR ? 2 : Math.max(3, draft.capacityMinimum),
      capacityMaximum: format === ActivityFormat.PAIR ? 2 : Math.max(4, draft.capacityMaximum),
    });
  };

  const save = async () => {
    if (!onSaveDraft || busy) return;
    setActionError('');
    try { await onSaveDraft(draft); }
    catch (error) { setActionError(error instanceof Error ? error.message : '草稿保存失败，请重试'); }
  };

  const submit = async () => {
    if (!validStepTwo || !reviewConfirmed || busy) return;
    setActionError('');
    try { await onSubmitForReview(draft); }
    catch (error) { setActionError(error instanceof Error ? error.message : '提交状态尚未确认，请稍后重试'); }
  };

  if (submissionState === 'submitted') {
    return (
      <section className="page create-layout create-success screen-enter" aria-labelledby="create-result-title" data-screen-label="活动提交结果">
        <span className="success-mark"><Check size={32} /></span>
        <h1 id="create-result-title">活动已提交审核</h1>
        <p>{submissionMessage ?? '审核通过后才会公开招募；提交不等于立即发布。'}</p>
        <button type="button" className="primary-button" onClick={onCancel}>完成</button>
      </section>
    );
  }

  return (
    <section className="page create-layout screen-enter" aria-labelledby="create-title" data-screen-label="发起活动">
      <header className="page-header create-page-header">
        <button type="button" className="icon-button" aria-label={step === 1 ? '取消创建活动' : '返回上一步'} onClick={() => step === 1 ? onCancel() : onStepChange(1)}><ArrowLeft size={21} /></button>
        <div><span>草稿 {shortDraftId(draftId)}</span><h1 id="create-title">发起活动</h1></div>
        <strong>{step} / 2</strong>
      </header>
      <div className="create-progress" aria-label={`创建进度，第 ${step} 步，共 2 步`}><i style={{ width: `${step * 50}%` }} /></div>

      {step === 1 ? (
        <main className="form-section">
          <div className="form-intro"><span>第一步 · 公开信息</span><h2>先说明要一起做什么</h2><p>这些内容将在活动通过审核后公开展示。</p></div>

          <fieldset>
            <legend>活动类型</legend>
            <div className="choice-grid choice-grid--compact">
              {categoryOptions.map(([value, label]) => <button key={value} type="button" className={draft.category === value ? 'is-active' : ''} aria-pressed={draft.category === value} onClick={() => update('category', value)}><b>{label}</b></button>)}
            </div>
          </fieldset>

          <label>活动标题
            <input value={draft.title} maxLength={48} placeholder="例如：莫奈夜展后，沿江散步 40 分钟" onChange={(event) => update('title', event.target.value)} />
            <small>{draft.title.length}/48</small>
          </label>
          <label>活动简介
            <textarea value={draft.summary} maxLength={160} rows={3} placeholder="说明活动内容、节奏，以及适合怎样的同行者" onChange={(event) => update('summary', event.target.value)} />
            <small>{draft.summary.length}/160</small>
          </label>

          <fieldset>
            <legend>活动规模</legend>
            <div className="choice-grid">
              <button type="button" className={draft.format === ActivityFormat.PAIR ? 'is-active' : ''} aria-pressed={draft.format === ActivityFormat.PAIR} onClick={() => selectFormat(ActivityFormat.PAIR)}><b>双人同行</b><span>固定 2 人，专注一次相遇</span></button>
              <button type="button" className={draft.format === ActivityFormat.GROUP ? 'is-active' : ''} aria-pressed={draft.format === ActivityFormat.GROUP} onClick={() => selectFormat(ActivityFormat.GROUP)}><b>多人小组</b><span>至少 3 人，按人数条件成行</span></button>
            </div>
          </fieldset>

          <fieldset>
            <legend>参与方式</legend>
            <div className="choice-grid">
              {participationOptions.map(([value, label, description]) => (
                <button key={value} type="button" className={draft.participationMode === value ? 'is-active' : ''} aria-pressed={draft.participationMode === value} onClick={() => update('participationMode', value)}><b>{label}</b><span>{description}</span></button>
              ))}
            </div>
          </fieldset>

          <div className="form-actions">
            {onSaveDraft && <button type="button" className="secondary-button" disabled={busy} onClick={save}><FilePenLine size={16} />保存草稿</button>}
            <button type="button" className="primary-button" disabled={!validStepOne || busy} onClick={() => onStepChange(2)}>下一步：时间与规则</button>
          </div>
        </main>
      ) : (
        <main className="form-section">
          <div className="form-intro"><span>第二步 · 履约信息</span><h2>确认时间、区域与参与规则</h2><p>公开区域不应包含门牌、手机号或私人住址。</p></div>

          <div className="form-grid">
            <label>开始时间<input type="datetime-local" value={draft.startsAt} onChange={(event) => update('startsAt', event.target.value)} /></label>
            <label>结束时间<input type="datetime-local" value={draft.endsAt} min={draft.startsAt} onChange={(event) => update('endsAt', event.target.value)} /></label>
            <label>城市<input value={draft.city} onChange={(event) => update('city', event.target.value)} /></label>
            <label>行政区<input value={draft.district} placeholder="例如：徐汇区" onChange={(event) => update('district', event.target.value)} /></label>
          </div>
          <label>公开活动区域
            <input value={draft.areaLabel} placeholder="例如：徐汇滨江公共文化区域" onChange={(event) => update('areaLabel', event.target.value)} />
            <small><Eye size={13} /> 所有人可见；精确集合点应在确认参与后另行提供</small>
          </label>

          <div className="form-grid">
            <label>最低成行人数<input type="number" min={2} max={draft.capacityMaximum} disabled={draft.format === ActivityFormat.PAIR} value={draft.capacityMinimum} onChange={(event) => update('capacityMinimum', Number(event.target.value))} /></label>
            <label>最多参与人数<input type="number" min={draft.capacityMinimum} max={20} disabled={draft.format === ActivityFormat.PAIR} value={draft.capacityMaximum} onChange={(event) => update('capacityMaximum', Number(event.target.value))} /></label>
          </div>
          <label>预计人均费用（元，可留空）<input inputMode="decimal" value={draft.priceInYuan} placeholder="例如：88" onChange={(event) => update('priceInYuan', event.target.value.replace(/[^0-9.]/g, ''))} /></label>
          <label>活动流程<textarea rows={4} value={draft.agenda} placeholder="每行一个环节，例如：18:30 集合并一起观展" onChange={(event) => update('agenda', event.target.value)} /></label>
          <label>氛围标签<input value={draft.atmosphereTags} placeholder="用逗号分隔，例如：慢节奏, 公共场所" onChange={(event) => update('atmosphereTags', event.target.value)} /></label>
          <label>安全与边界说明<textarea rows={3} value={draft.safetyNotice} onChange={(event) => update('safetyNotice', event.target.value)} /></label>

          <section className="review-summary">
            <ShieldCheck size={20} />
            <div><strong>下一步是提交审核，不是直接发布</strong><p>平台会审核公开信息、时间地点与安全规则。审核通过后活动才会进入推荐和搜索。</p></div>
          </section>
          <label className="review-confirmation"><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} /><span>我确认公开信息真实，且不包含精确集合点或他人隐私。</span></label>
          {(actionError || (submissionState === 'error' && submissionMessage)) && <p className="form-error" role="alert"><CircleAlert size={15} />{actionError || submissionMessage}</p>}

          <div className="form-actions">
            <button type="button" className="secondary-button" disabled={busy} onClick={() => onStepChange(1)}>上一步</button>
            {onSaveDraft && <button type="button" className="secondary-button" disabled={busy} onClick={save}>保存草稿</button>}
            <button type="button" className="primary-button" disabled={!validStepTwo || !reviewConfirmed || busy} onClick={submit}>{submissionState === 'submitting' ? '正在提交审核…' : '提交审核'}</button>
          </div>
        </main>
      )}
    </section>
  );
}

function shortDraftId(draftId: string) {
  return draftId.length > 14 ? `${draftId.slice(0, 6)}…${draftId.slice(-4)}` : draftId;
}
