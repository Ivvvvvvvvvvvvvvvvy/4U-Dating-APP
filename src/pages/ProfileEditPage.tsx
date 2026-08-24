import { useState } from 'react';
import { ArrowLeft, Check, ChevronRight } from 'lucide-react';
import { MbtiType, RelationshipGoal, type Person } from '../domain';
import { saveProfileEdit } from '../auth/profile';

const goalOptions: readonly { id: RelationshipGoal; label: string; description: string }[] = [
  { id: RelationshipGoal.LONG_TERM, label: '寻找长期关系', description: '愿意以稳定、持续了解为方向建立关系。' },
  { id: RelationshipGoal.SERIOUS_DATING, label: '认真约会', description: '希望从真实见面开始，认真判断彼此是否合适。' },
  { id: RelationshipGoal.OPEN_TO_EXPLORE, label: '开放探索', description: '不预设唯一结果，但会清楚表达边界与节奏。' },
];

const mbtiOptions = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP','UNSURE'];

const interestOptions = ['独立电影','城市漫步','咖啡探店','现场音乐','徒步','摄影','阅读','做饭','旅行','展览','桌游','跑步','瑜伽','宠物','公益','播客','滑雪','露营','羽毛球','戏剧','手作','骑行','动漫','美食'];

export interface ProfileEditPageProps {
  person: Person;
  privacy: { showAge: boolean; showZodiac: boolean; showOrientation: boolean };
  userId: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function ProfileEditPage({ person, privacy, userId, onSaved, onCancel }: ProfileEditPageProps) {
  const [displayName, setDisplayName] = useState(person.displayName === '未命名' ? '' : person.displayName);
  const [city, setCity] = useState(person.city);
  const [occupation, setOccupation] = useState(person.occupation);
  const [bio, setBio] = useState(person.bio);
  const [goal, setGoal] = useState<RelationshipGoal>(person.relationshipGoal);
  const [mbti, setMbti] = useState(person.mbti === MbtiType.UNSURE ? 'UNSURE' : person.mbti);
  const [interests, setInterests] = useState<string[]>([...person.interests]);
  const [prompt, setPrompt] = useState(person.prompts[0]?.answer ?? '');
  const [showAge, setShowAge] = useState(privacy.showAge);
  const [showZodiac, setShowZodiac] = useState(privacy.showZodiac);
  const [showOrientation, setShowOrientation] = useState(privacy.showOrientation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleInterest = (value: string) => {
    setError('');
    setInterests((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (current.length >= 5) {
        setError('最多选择 5 个兴趣');
        return current;
      }
      return [...current, value];
    });
  };

  const submit = async () => {
    if (displayName.trim().length < 2) { setError('昵称至少需要 2 个字'); return; }
    if (!city.trim()) { setError('请填写城市'); return; }
    setBusy(true);
    setError('');
    try {
      await saveProfileEdit(userId, {
        displayName,
        city,
        occupation,
        bio,
        relationshipGoal: goal,
        mbti,
        interests,
        promptAnswer: prompt,
        showAge,
        showZodiac,
        showOrientation,
      });
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="onboarding-shell screen-enter" aria-labelledby="profile-edit-title">
      <header className="onboarding-header">
        <button type="button" className="onboarding-back" aria-label="返回" onClick={onCancel}><ArrowLeft size={20}/></button>
        <span className="onboarding-brand" aria-label="编辑个人资料"><strong>for</strong><span>U</span><i/></span>
        <span className="onboarding-save is-saved">资料编辑</span>
      </header>
      <main className="onboarding-main" id="main-content">
        <div className="onboarding-intro"><span>编辑个人资料</span><h1 id="profile-edit-title">调整你的公开资料</h1><p>修改后实时生效，不会影响已审核的照片与推荐资格。</p></div>

        <div className="field-grid">
          <label className="field"><span>昵称 <b>必填</b></span><input maxLength={20} value={displayName} placeholder="2～20 个字" onChange={(e) => setDisplayName(e.target.value)}/></label>
          <label className="field"><span>当前城市 <b>必填</b></span><input value={city} onChange={(e) => setCity(e.target.value)}/></label>
        </div>
        <label className="field"><span>职业 <em>选填</em></span><input maxLength={30} value={occupation} placeholder="例如：产品设计师" onChange={(e) => setOccupation(e.target.value)}/></label>

        <section className="selection-section">
          <header><div><h2>关系意图</h2><p>你想建立怎样的连接？</p></div></header>
          <div className="orientation-grid">
            {goalOptions.map((option) => (
              <button key={option.id} type="button" role="radio" aria-checked={goal === option.id} className={goal === option.id ? 'is-active' : ''} onClick={() => setGoal(option.id)}>
                <span><strong>{option.label}</strong><small>{option.description}</small></span>
                {goal === option.id && <Check/>}
              </button>
            ))}
          </div>
        </section>

        <section className="selection-section">
          <header><div><h2>MBTI</h2><p>哪个类型更接近你？</p></div></header>
          <div className="mbti-grid">
            {mbtiOptions.map((option) => (
              <button key={option} type="button" className={mbti === option ? 'is-active' : ''} aria-pressed={mbti === option} onClick={() => setMbti(option)}>
                {option === 'UNSURE' ? '暂不确定' : option}{mbti === option && <Check/>}
              </button>
            ))}
          </div>
        </section>

        <section className="selection-section">
          <div className="interest-head"><strong>兴趣标签</strong><span>保存（{interests.length}/5）</span></div>
          <div className="interest-cloud">
            {interestOptions.map((option) => (
              <button key={option} type="button" aria-pressed={interests.includes(option)} className={interests.includes(option) ? 'is-active' : ''} onClick={() => toggleInterest(option)}>
                {interests.includes(option) && <Check/>}{option}
              </button>
            ))}
          </div>
        </section>

        <label className="field"><span>自我介绍 <em>选填</em></span><textarea rows={4} maxLength={300} value={bio} placeholder="还有什么想让别人了解？" onChange={(e) => setBio(e.target.value)}/></label>
        <div className="prompt-card"><span>周末最想和另一个人一起做什么？</span><textarea rows={5} maxLength={200} value={prompt} placeholder="写下 20～200 字的真实回答…" onChange={(e) => setPrompt(e.target.value)}/><small>{prompt.length}/200</small></div>

        <div className="permission-list">
          <ToggleRow title="公开年龄" text="只展示派生年龄，不展示完整生日" value={showAge} onChange={setShowAge}/>
          <ToggleRow title="公开星座" text="星座只作为趣味弱信号" value={showZodiac} onChange={setShowZodiac}/>
          <ToggleRow title="公开性取向" text="仅在你已选择并愿意公开时展示" value={showOrientation} onChange={setShowOrientation}/>
        </div>

        {error && <p className="onboarding-error" role="alert">{error}</p>}
      </main>
      <footer className="onboarding-footer">
        <button className="onboarding-primary" disabled={busy} onClick={() => void submit()}>{busy ? '保存中…' : '保存修改'} <ChevronRight size={18}/></button>
        <button className="onboarding-secondary" onClick={onCancel}>取消</button>
      </footer>
    </section>
  );
}

function ToggleRow({ title, text, value, onChange }: { title: string; text: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button className="toggle-row" role="switch" aria-checked={value} onClick={() => onChange(!value)}>
      <span><strong>{title}</strong><small>{text}</small></span>
      <i className={value ? 'is-on' : ''}><b/></i>
    </button>
  );
}
