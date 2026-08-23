import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Clock3, Eye, Heart, ImagePlus, LockKeyhole, Mail, MapPin, ShieldCheck, Sparkles, UserRound, UsersRound, WandSparkles } from 'lucide-react';
import type { OnboardingStep } from '../router';

type SaveState = 'saved' | 'saving' | 'offline';
type Intent = 'LONG_TERM_PARTNER' | 'LONG_TERM_OPEN_TO_SHORT' | 'SHORT_TERM_OPEN_TO_LONG' | 'SHORT_TERM_FUN' | 'NEW_FRIENDS' | 'FIGURING_OUT';

interface OnboardingDraft {
  acceptedTerms: boolean;
  acceptedRules: boolean;
  accountMode: 'email' | 'phone';
  account: string;
  code: string;
  verified: boolean;
  region: string;
  birthday: string;
  nickname: string;
  city: string;
  gender: string;
  occupation: string;
  orientations: string[];
  showOrientation: boolean;
  intent: Intent | '';
  meetGenders: string[];
  minAge: number;
  maxAge: number;
  mbti: string;
  interests: string[];
  lifestyle: Record<string, string>;
  photoCount: number;
  personhood: boolean;
  prompt: string;
  bio: string;
  aiCompatibility: boolean;
  publicExplanation: boolean;
  modelTraining: boolean;
  aiConfirmed: boolean;
  showAge: boolean;
  showZodiac: boolean;
}

const steps: OnboardingStep[] = ['welcome', 'account', 'adult-check', 'identity', 'preferences', 'mbti', 'interests', 'photos', 'expression', 'ai-review', 'privacy-preview'];
const initialDraft: OnboardingDraft = {
  acceptedTerms: false, acceptedRules: false, accountMode: 'email', account: '', code: '', verified: false,
  region: '中国大陆', birthday: '', nickname: '', city: '上海', gender: '', occupation: '', orientations: [], showOrientation: false,
  intent: '', meetGenders: [], minAge: 22, maxAge: 35, mbti: '', interests: [], lifestyle: {}, photoCount: 0, personhood: false,
  prompt: '', bio: '', aiCompatibility: false, publicExplanation: false, modelTraining: false, aiConfirmed: false, showAge: true, showZodiac: false,
};

const intentOptions: { id: Intent; icon: string; label: string }[] = [
  { id: 'LONG_TERM_PARTNER', icon: '💘', label: '寻找长期的伴侣' },
  { id: 'LONG_TERM_OPEN_TO_SHORT', icon: '😍', label: '长期交往，但不拒绝短期交往' },
  { id: 'SHORT_TERM_OPEN_TO_LONG', icon: '🥂', label: '短期交往，但不拒绝长期交往' },
  { id: 'SHORT_TERM_FUN', icon: '🎉', label: '享受短期交往的乐趣' },
  { id: 'NEW_FRIENDS', icon: '👋', label: '结交新朋友' },
  { id: 'FIGURING_OUT', icon: '🤔', label: '我还在思考' },
];
const orientationOptions = [
  ['HETEROSEXUAL','异性恋','仅会被不同性别吸引的人士'], ['GAY_MAN','男同性恋','会被同性吸引的男性'], ['LESBIAN','女同性恋','会被女性吸引、可能建立浪漫关系的女性'],
  ['BISEXUAL','双性恋','可能被一种以上性别吸引的人士'], ['ASEXUAL','无性恋','很少或不会感受到性吸引的人士'], ['DEMISEXUAL','半性恋','通常在深厚情感联系后感受到性吸引'],
  ['PANSEXUAL','泛性恋','吸引不以对方性别为主要前提'], ['QUEER','酷儿','性取向或性别身份的包容性统称'], ['QUESTIONING','疑性恋','正在探索自身性取向和／或性别'], ['NOT_LISTED','未列出','以上选项未能描述自己'],
] as const;
const interestOptions = ['独立电影','城市漫步','咖啡探店','现场音乐','徒步','摄影','阅读','做饭','旅行','展览','桌游','跑步','瑜伽','宠物','公益','播客','滑雪','露营','羽毛球','戏剧','手作','骑行','动漫','美食'];
const mbtiOptions = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP','UNSURE'];

const loadSafeDraft = (): Partial<OnboardingDraft> => {
  try { return JSON.parse(localStorage.getItem('4u:onboarding-safe-draft') ?? '{}') as Partial<OnboardingDraft>; } catch { return {}; }
};

export function OnboardingPage({ step, online, onNavigate }: { step: OnboardingStep; online: boolean; onNavigate: (path: string) => void }) {
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({ ...initialDraft, ...loadSafeDraft(), account: '', code: '', birthday: '', prompt: '', bio: '' }));
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [error, setError] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const index = steps.indexOf(step);
  const displayIndex = Math.max(0, index) + 1;
  const update = <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (step === 'welcome' || step === 'status' || step === 'revise') return;
    setSaveState(online ? 'saving' : 'offline');
    const timer = window.setTimeout(() => {
      if (!online) return;
      const { account: _account, code: _code, birthday: _birthday, prompt: _prompt, bio: _bio, ...safe } = draft;
      localStorage.setItem('4u:onboarding-safe-draft', JSON.stringify(safe));
      setSaveState('saved');
    }, 800);
    return () => window.clearTimeout(timer);
  }, [draft, online, step]);

  const age = useMemo(() => {
    if (!draft.birthday) return null;
    const birth = new Date(`${draft.birthday}T00:00:00`); const today = new Date();
    let result = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) result -= 1;
    return Number.isFinite(result) ? result : null;
  }, [draft.birthday]);

  const canContinue = validateStep(step, draft, age);
  const goNext = () => {
    setError('');
    if (!canContinue) { setError(stepError(step)); return; }
    if (step === 'privacy-preview') { onNavigate('/onboarding/status'); return; }
    const next = steps[index + 1]; if (next) onNavigate(`/onboarding/${next}`);
  };
  const goBack = () => index > 0 ? onNavigate(`/onboarding/${steps[index - 1]}`) : onNavigate('/home?primary=topics&secondary=hot');

  if (step === 'status') return <StatusPage onNavigate={onNavigate} />;
  if (step === 'revise') return <RevisePage onNavigate={onNavigate} />;

  return (
    <section className="onboarding-shell screen-enter" aria-labelledby="onboarding-title">
      <header className="onboarding-header">
        <button type="button" className="onboarding-back" aria-label="返回" onClick={goBack}><ArrowLeft size={20}/></button>
        <button type="button" className="onboarding-brand" onClick={() => onNavigate('/onboarding/welcome')} aria-label="4U 欢迎页"><strong>for</strong><span>U</span><i/></button>
        {step === 'welcome' ? <span className="onboarding-time"><Clock3 size={14}/>约 3～5 分钟</span> : <span className={`onboarding-save is-${saveState}`}>{saveState === 'saving' ? '保存中…' : saveState === 'offline' ? '离线未同步' : '已保存'}</span>}
      </header>
      {step !== 'welcome' && <div className="onboarding-progress" aria-label={`第 ${displayIndex} 步，共 11 步`}><span style={{ width: `${displayIndex / 11 * 100}%` }}/></div>}
      <main className="onboarding-main" id="main-content">
        {step === 'welcome' && <Welcome draft={draft} update={update}/>} 
        {step === 'account' && <Account draft={draft} update={update} codeSent={codeSent} onSendCode={() => { if (!draft.account.trim()) return setError('请先填写手机号或邮箱'); setCodeSent(true); setError(''); }} />}
        {step === 'adult-check' && <AdultCheck draft={draft} update={update} age={age}/>} 
        {step === 'identity' && <Identity draft={draft} update={update}/>} 
        {step === 'preferences' && <Preferences draft={draft} update={update}/>} 
        {step === 'mbti' && <Mbti draft={draft} update={update}/>} 
        {step === 'interests' && <Interests draft={draft} update={update} setError={setError}/>} 
        {step === 'photos' && <Photos draft={draft} update={update}/>} 
        {step === 'expression' && <Expression draft={draft} update={update}/>} 
        {step === 'ai-review' && <AiReview draft={draft} update={update}/>} 
        {step === 'privacy-preview' && <PrivacyPreview draft={draft} update={update}/>} 
        {error && <p className="onboarding-error" role="alert">{error}</p>}
      </main>
      <footer className="onboarding-footer">
        {step === 'welcome' ? <>
          <button className="onboarding-primary" disabled={!canContinue} onClick={goNext}>开始建档 <ChevronRight size={18}/></button>
          <button className="onboarding-secondary" onClick={() => onNavigate('/home?primary=topics&secondary=hot')}>先逛逛公开内容</button>
        </> : <>
          <button className="onboarding-primary" disabled={!canContinue} onClick={goNext}>{step === 'privacy-preview' ? '提交资料审核' : '继续'} <ChevronRight size={18}/></button>
          <button className="onboarding-secondary" onClick={() => onNavigate('/home?primary=topics&secondary=hot')}>稍后完成，先浏览公开内容</button>
        </>}
      </footer>
    </section>
  );
}

type Update = <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => void;

function StepIntro({ eyebrow, title, text, privacy }: { eyebrow: string; title: string; text: string; privacy: string }) {
  return <div className="onboarding-intro"><span>{eyebrow}</span><h1 id="onboarding-title">{title}</h1><p>{text}</p><small><LockKeyhole size={13}/>{privacy}</small></div>;
}
function Welcome({ draft, update }: { draft: OnboardingDraft; update: Update }) {
  return <div className="onboarding-welcome">
    <div className="welcome-orbit"><span><UserRound/></span><span><UsersRound/></span><span><Heart/></span><i>4U</i></div>
    <StepIntro eyebrow="欢迎来到 4U" title="先让 4U 认识真实的你" text="通过真实资料、共同兴趣和明确意愿，认识值得了解的人。" privacy="每项信息都会说明用途和可见范围"/>
    <div className="promise-grid"><article><UserRound/><strong>从人开始</strong><span>发现更合拍的人</span></article><article><UsersRound/><strong>从活动开始</strong><span>在同行中自然认识</span></article><article><Sparkles/><strong>从话题开始</strong><span>先聊观点再决定</span></article></div>
    <div className="onboarding-commitments"><p><Check/>不会公开你的完整生日</p><p><Check/>不会展示单向心动</p><p><Check/>AI 不替你表达关系意愿</p></div>
    <label className="consent-row"><input type="checkbox" checked={draft.acceptedTerms} onChange={(event) => update('acceptedTerms', event.target.checked)}/><span>我已阅读并同意《服务条款》和《隐私政策》</span></label>
    <label className="consent-row"><input type="checkbox" checked={draft.acceptedRules} onChange={(event) => update('acceptedRules', event.target.checked)}/><span>我已阅读并同意《社区规则》</span></label>
  </div>;
}
function Account({ draft, update, codeSent, onSendCode }: { draft: OnboardingDraft; update: Update; codeSent: boolean; onSendCode: () => void }) {
  return <><StepIntro eyebrow="1 / 11 · 账号验证" title="保存你的建档进度" text="验证一种联系方式，就能跨设备安全续填。" privacy="联系方式仅用于账号与安全，不会公开"/>
    <div className="segmented"><button className={draft.accountMode==='email'?'is-active':''} onClick={()=>update('accountMode','email')}>邮箱</button><button className={draft.accountMode==='phone'?'is-active':''} onClick={()=>update('accountMode','phone')}>手机号</button></div>
    <label className="field"><span>{draft.accountMode==='email'?'邮箱':'手机号'} <b>必填</b></span><div><Mail size={17}/><input value={draft.account} placeholder={draft.accountMode==='email'?'name@example.com':'请输入手机号'} onChange={(e)=>update('account',e.target.value)}/></div></label>
    <div className="verification-row"><label className="field"><span>验证码</span><div><input inputMode="numeric" maxLength={6} value={draft.code} placeholder="6 位验证码" onChange={(e)=>update('code',e.target.value)}/></div></label><button onClick={onSendCode}>{codeSent?'重新发送':'发送验证码'}</button></div>
    {codeSent && <button className="verify-button" onClick={()=>update('verified',draft.code.length>=4)}><Check size={16}/>{draft.verified?'验证成功':'验证并继续'}</button>}
  </>;
}
function AdultCheck({ draft, update, age }: { draft: OnboardingDraft; update: Update; age: number | null }) {
  return <><StepIntro eyebrow="2 / 11 · 成年校验" title="确认你已达到服务年龄" text="服务地区决定适用的成年规则，生日输入后会由服务端再次校验。" privacy="完整生日永不公开，也不会进入 AI 理由"/>
    <label className="field"><span>服务地区 <b>必填</b></span><select value={draft.region} onChange={(e)=>update('region',e.target.value)}><option>中国大陆</option><option>中国香港</option><option>日本</option><option>新加坡</option></select></label>
    <label className="field"><span>出生日期 <b>必填</b></span><input type="date" value={draft.birthday} onChange={(e)=>update('birthday',e.target.value)}/></label>
    {age !== null && <div className={`age-result ${age < 18 ? 'is-blocked' : ''}`}>{age < 18 ? <><ShieldCheck/><div><strong>暂时无法继续</strong><p>当前资料未达到服务年龄要求。你可以查看帮助与数据处理说明。</p></div></> : <><Check/><div><strong>年龄校验通过 · {age} 岁</strong><p>个人资料是否展示年龄，会在最后一步由你决定。</p></div></>}</div>}
  </>;
}
function Identity({ draft, update }: { draft: OnboardingDraft; update: Update }) {
  const toggleOrientation=(id:string)=>{const next=draft.orientations.includes(id)?draft.orientations.filter(x=>x!==id):[...draft.orientations,id];update('orientations',next);if(!next.length)update('showOrientation',false);};
  return <><StepIntro eyebrow="3 / 11 · 基本身份" title="怎样称呼你？" text="基本资料用于建立个人卡；性取向是选填敏感信息，不会被系统推断。" privacy="性取向默认仅自己可见"/>
    <div className="field-grid"><label className="field"><span>昵称 <b>必填</b></span><input maxLength={20} value={draft.nickname} placeholder="2～20 个字" onChange={(e)=>update('nickname',e.target.value)}/></label><label className="field"><span>当前城市 <b>必填</b></span><input value={draft.city} onChange={(e)=>update('city',e.target.value)}/></label></div>
    <label className="field"><span>自我性别 <b>必填</b></span><div className="choice-chips">{['女性','男性','非二元','自定义'].map(x=><button type="button" className={draft.gender===x?'is-active':''} aria-pressed={draft.gender===x} onClick={()=>update('gender',x)} key={x}>{x}</button>)}</div></label>
    <label className="field"><span>职业 <em>选填</em></span><input maxLength={30} value={draft.occupation} placeholder="例如：产品设计师" onChange={(e)=>update('occupation',e.target.value)}/></label>
    <section className="selection-section"><header><div><h2>你的性向是什么？</h2><p>请选择所有适用选项，也可以暂不选择。</p></div><span>{draft.orientations.length}/10</span></header><div className="orientation-grid">{orientationOptions.map(([id,label,desc])=><button key={id} role="checkbox" aria-checked={draft.orientations.includes(id)} className={draft.orientations.includes(id)?'is-active':''} onClick={()=>toggleOrientation(id)}><span><strong>{label}</strong><small>{desc}</small></span>{draft.orientations.includes(id)&&<Check/>}</button>)}</div>
    <label className={`consent-row ${!draft.orientations.length?'is-disabled':''}`}><input type="checkbox" disabled={!draft.orientations.length} checked={draft.showOrientation} onChange={(e)=>update('showOrientation',e.target.checked)}/><span>在个人资料里显示我的性取向</span></label></section>
  </>;
}
function Preferences({ draft, update }: { draft: OnboardingDraft; update: Update }) {
  const toggleMeet=(value:string)=>update('meetGenders',draft.meetGenders.includes(value)?draft.meetGenders.filter(x=>x!==value):[...draft.meetGenders,value]);
  return <><StepIntro eyebrow="4 / 11 · 交往意向" title="你想要查找什么？" text="你可以随时更改交往意向。每个人都可以在这里找到自己想要的人际交往。" privacy="这些条件会双向生效，供给不足时不会偷偷放宽"/>
    <div className="intent-grid">{intentOptions.map(x=><button key={x.id} role="radio" aria-checked={draft.intent===x.id} className={draft.intent===x.id?'is-active':''} onClick={()=>update('intent',x.id)}><b>{x.icon}</b><span>{x.label}</span>{draft.intent===x.id&&<Check/>}</button>)}</div>
    <label className="field"><span>希望认识的人群 <b>必填</b></span><div className="choice-chips">{['女性','男性','非二元'].map(x=><button key={x} type="button" className={draft.meetGenders.includes(x)?'is-active':''} aria-pressed={draft.meetGenders.includes(x)} onClick={()=>toggleMeet(x)}>{x}</button>)}</div></label>
    <div className="field-grid"><label className="field"><span>最低年龄</span><input type="number" min={18} max={80} value={draft.minAge} onChange={(e)=>update('minAge',Number(e.target.value))}/></label><label className="field"><span>最高年龄</span><input type="number" min={18} max={80} value={draft.maxAge} onChange={(e)=>update('maxAge',Number(e.target.value))}/></label></div>
  </>;
}
function Mbti({ draft, update }: { draft: OnboardingDraft; update: Update }) { return <><StepIntro eyebrow="5 / 11 · MBTI" title="哪个类型更接近你？" text="不需要做测试，也可以选择暂不确定。MBTI 只会作为较弱的参考信号。" privacy="是否公开、用于推荐和 AI 理由会分别确认"/><div className="mbti-grid">{mbtiOptions.map(x=><button key={x} className={draft.mbti===x?'is-active':''} aria-pressed={draft.mbti===x} onClick={()=>update('mbti',x)}>{x==='UNSURE'?'暂不确定':x}{draft.mbti===x&&<Check/>}</button>)}</div></>; }
function Interests({ draft, update, setError }: { draft: OnboardingDraft; update: Update; setError: (value:string)=>void }) {
  const toggle=(value:string)=>{if(draft.interests.includes(value))return update('interests',draft.interests.filter(x=>x!==value));if(draft.interests.length>=5)return setError('最多选择 5 个兴趣');setError('');update('interests',[...draft.interests,value]);};
  const setLife=(q:string,a:string)=>update('lifestyle',{...draft.lifestyle,[q]:a});
  return <><StepIntro eyebrow="6 / 11 · 兴趣与生活" title="你的兴趣是什么？" text="最多选择 5 个，也可以暂时不选；我们不会替你猜测兴趣。" privacy="保存的兴趣会展示在个人资料；推荐与 AI 用途稍后单独授权"/>
    <div className="interest-head"><strong>兴趣标签</strong><span>保存（{draft.interests.length}/5）</span></div><div className="interest-cloud">{interestOptions.map(x=><button key={x} aria-pressed={draft.interests.includes(x)} className={draft.interests.includes(x)?'is-active':''} onClick={()=>toggle(x)}>{draft.interests.includes(x)&&<Check/>}{x}</button>)}</div>
    <section className="lifestyle-section"><h2>生活方式小问题 <span>{Object.keys(draft.lifestyle).length}/3</span></h2>{[['weekend','理想周末更接近？',['提前计划','随心而动','一半一半','不确定']],['social','舒服的社交密度？',['热闹多人','少数熟人','独处充电','看状态']],['reply','期待的沟通节奏？',['及时分享','集中回复','轻松随缘','不确定']]].map(([id,q,answers])=><div className="lifestyle-question" key={id as string}><strong>{q as string}</strong><div className="choice-chips">{(answers as string[]).map(a=><button key={a} className={draft.lifestyle[id as string]===a?'is-active':''} onClick={()=>setLife(id as string,a)}>{a}</button>)}</div></div>)}</section>
  </>;
}
function Photos({ draft, update }: { draft: OnboardingDraft; update: Update }) { return <><StepIntro eyebrow="7 / 11 · 照片与真人验证" title="让个人卡更真实" text="上传 2～6 张照片，至少包含一张清晰单人照，并指定封面。" privacy="未通过审核的照片不会公开；上传时会清理 EXIF 与定位信息"/><div className="photo-grid">{Array.from({length:6},(_,i)=><button key={i} className={i<draft.photoCount?'is-filled':''} onClick={()=>update('photoCount',i<draft.photoCount?i:Math.min(6,draft.photoCount+1))}>{i<draft.photoCount?<><span>{i===0?'封面':`照片 ${i+1}`}</span><Check/></>:<><ImagePlus/><span>添加照片</span></>}</button>)}</div><button className={`personhood-card ${draft.personhood?'is-active':''}`} disabled={draft.photoCount<2} onClick={()=>update('personhood',!draft.personhood)}><ShieldCheck/><span><strong>{draft.personhood?'真人验证已提交':'立即真人验证'}</strong><small>进入个人推荐池前需要完成，可稍后在状态页继续</small></span><ChevronRight/></button></>; }
function Expression({ draft, update }: { draft: OnboardingDraft; update: Update }) { const polish=()=>draft.prompt.trim()&&update('prompt',draft.prompt.trim().replace(/[。！]?$/,'。')+' 我也很想听听你的答案。'); return <><StepIntro eyebrow="8 / 11 · 个人表达" title="用一句话开启了解" text="选择一个 Prompt 并写下真实答案。AI 只会在你主动点击后润色现有文字。" privacy="AI 草稿采纳前不会公开，也不会参与匹配"/><div className="prompt-card"><span>周末最想和另一个人一起做什么？</span><textarea rows={5} maxLength={200} value={draft.prompt} placeholder="写下 20～200 字的真实回答…" onChange={(e)=>update('prompt',e.target.value)}/><small>{draft.prompt.length}/200</small><button onClick={polish}><WandSparkles/>帮我润色</button></div><label className="field"><span>自我介绍 <em>选填</em></span><textarea rows={4} maxLength={300} value={draft.bio} placeholder="还有什么想让别人了解？" onChange={(e)=>update('bio',e.target.value)}/></label></>; }
function AiReview({ draft, update }: { draft: OnboardingDraft; update: Update }) { return <><StepIntro eyebrow="9 / 11 · AI 理解与授权" title="AI 对你的理解" text="你可以开启、关闭或修改每项用途。不启用 AI 也可以完成建档。" privacy="只有你确认的版本才能用于后续匹配或解释"/><div className="ai-summary"><Sparkles/><div><strong>目前了解到</strong><p>交往意向：{intentOptions.find(x=>x.id===draft.intent)?.label??'尚未选择'}</p><p>兴趣：{draft.interests.length?draft.interests.join('、'):'兴趣信息尚未提供'}</p><p>生活与沟通：已回答 {Object.keys(draft.lifestyle).length} 项</p></div></div><div className="permission-list"><ToggleRow title="AI 契合与个性化推荐" text="使用你授权的结构化信息优化推荐" value={draft.aiCompatibility} onChange={(v)=>update('aiCompatibility',v)}/><ToggleRow title="对他人展示 AI 推荐理由" text="只使用逐字段允许进入解释的内容" value={draft.publicExplanation} onChange={(v)=>update('publicExplanation',v)}/><ToggleRow title="通用模型训练" text="默认关闭，不影响基础功能" value={draft.modelTraining} onChange={(v)=>update('modelTraining',v)}/></div><label className="consent-row"><input type="checkbox" checked={draft.aiConfirmed} onChange={(e)=>update('aiConfirmed',e.target.checked)}/><span>{draft.aiCompatibility?'我确认以上 AI 理解与授权选择':'继续不启用 AI 契合功能'}</span></label></>; }
function ToggleRow({title,text,value,onChange}:{title:string;text:string;value:boolean;onChange:(v:boolean)=>void}) { return <button className="toggle-row" role="switch" aria-checked={value} onClick={()=>onChange(!value)}><span><strong>{title}</strong><small>{text}</small></span><i className={value?'is-on':''}><b/></i></button>; }
function PrivacyPreview({ draft, update }: { draft: OnboardingDraft; update: Update }) { return <><StepIntro eyebrow="10 / 11 · 权限与预览" title="提交前，确认别人会看到什么" text="筛选、推荐、公开和 AI 理由是四种独立用途，随时可以在“我的”中修改。" privacy="联系方式、完整生日和候选偏好永不公开"/><div className="profile-preview"><div className="profile-preview-photo"><UserRound/><span>封面预览</span></div><div><span>{draft.city}<MapPin size={12}/></span><h2>{draft.nickname||'你的昵称'}{draft.showAge&&ageFromBirthday(draft.birthday)?`，${ageFromBirthday(draft.birthday)}`:''}</h2><p>{intentOptions.find(x=>x.id===draft.intent)?.label}</p>{draft.interests.length>0&&<div>{draft.interests.map(x=><i key={x}>{x}</i>)}</div>}{draft.showOrientation&&draft.orientations.length>0&&<small>性取向：{draft.orientations.map(x=>orientationOptions.find(y=>y[0]===x)?.[1]).join('、')}</small>}</div></div><div className="permission-list"><ToggleRow title="公开年龄" text="只展示派生年龄，不展示完整生日" value={draft.showAge} onChange={(v)=>update('showAge',v)}/><ToggleRow title="公开星座" text="星座只作为趣味弱信号" value={draft.showZodiac} onChange={(v)=>update('showZodiac',v)}/><ToggleRow title="公开性取向" text={draft.orientations.length?'与你在身份页的唯一公开开关同步':'未选择性取向，无法开启'} value={draft.showOrientation} onChange={(v)=>draft.orientations.length&&update('showOrientation',v)}/></div><div className="review-ready"><ShieldCheck/><div><strong>提交后将进入资料审核</strong><p>审核通过并完成真人验证后，才会进入推荐池。</p></div></div></>; }
function StatusPage({ onNavigate }: { onNavigate:(path:string)=>void }) { return <section className="onboarding-shell onboarding-status"><main><div className="status-illustration"><Clock3/><i/></div><span>资料审核中</span><h1>已经收到你的资料</h1><p>资料与照片会分别审核。审核通过并完成真人验证后，你会进入推荐池。</p><div className="status-checklist"><p className="is-done"><Check/><span><strong>资料已提交</strong><small>资料版本与权限版本已生成</small></span></p><p><Clock3/><span><strong>资料与照片审核</strong><small>预计 24 小时内完成</small></span></p><p><UserRound/><span><strong>真人验证</strong><small>可在这里继续完成，不影响资料先审核</small></span></p></div><button className="onboarding-primary" onClick={()=>onNavigate('/home?primary=topics&secondary=hot')}>浏览公开话题</button><button className="onboarding-secondary" onClick={()=>onNavigate('/onboarding/photos')}>继续真人验证</button></main></section>; }
function RevisePage({ onNavigate }: { onNavigate:(path:string)=>void }) { return <section className="onboarding-shell onboarding-status"><main><div className="status-illustration"><Eye/><i/></div><span>资料需要补充</span><h1>只修改有问题的部分</h1><p>照片清晰度需要调整，其他已通过内容会保留，不必重新填写。</p><div className="review-ready"><ImagePlus/><div><strong>第 1 张照片不够清晰</strong><p>请替换为光线充足、面部无遮挡的单人照。</p></div></div><button className="onboarding-primary" onClick={()=>onNavigate('/onboarding/photos')}>去修改照片</button></main></section>; }

function ageFromBirthday(value:string) { if(!value)return null; const birth=new Date(`${value}T00:00:00`),today=new Date();let age=today.getFullYear()-birth.getFullYear();if(today.getMonth()<birth.getMonth()||(today.getMonth()===birth.getMonth()&&today.getDate()<birth.getDate()))age--;return age; }
function validateStep(step:OnboardingStep,d:OnboardingDraft,age:number|null) { switch(step){case'welcome':return d.acceptedTerms&&d.acceptedRules;case'account':return d.verified;case'adult-check':return age!==null&&age>=18;case'identity':return d.nickname.trim().length>=2&&Boolean(d.city)&&Boolean(d.gender);case'preferences':return Boolean(d.intent)&&d.meetGenders.length>0&&d.minAge>=18&&d.maxAge>=d.minAge;case'mbti':return Boolean(d.mbti);case'interests':return Object.keys(d.lifestyle).length>=3;case'photos':return d.photoCount>=2;case'expression':return d.prompt.trim().length>=20;case'ai-review':return d.aiConfirmed;case'privacy-preview':return true;default:return true;} }
function stepError(step:OnboardingStep){return ({welcome:'请分别确认服务条款、隐私政策和社区规则',account:'请完成验证码验证', 'adult-check':'请填写有效生日并通过成年校验',identity:'请填写昵称、城市和自我性别',preferences:'请选择交往意向、希望认识的人群和有效年龄范围',mbti:'请选择一种 MBTI 或“暂不确定”',interests:'请完成 3 道生活方式小问题',photos:'请至少添加 2 张照片',expression:'请写下至少 20 个字的 Prompt 回答','ai-review':'请确认 AI 用途选择','privacy-preview':'请检查权限设置'} as Record<OnboardingStep,string>)[step]??'请完成当前步骤';}
