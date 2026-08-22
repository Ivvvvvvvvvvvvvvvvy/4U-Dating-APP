import { useState } from 'react';
import { ArrowLeftIcon, CheckIcon } from './Icons';

type Props = { onClose: () => void; onCreated: () => void };

export function CreateActivity({ onClose, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<'duo' | 'flex' | 'group'>('duo');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('看展');
  const [done, setDone] = useState(false);

  if (done) {
    return <div className="create-view create-success screen-enter"><div className="success-mark"><CheckIcon size={34}/></div><h1>活动已保存</h1><p>这是 MVP 演示，活动草稿已经保存在当前设备。</p><button className="primary-wide" onClick={() => { onCreated(); onClose(); }}>回到首页</button></div>;
  }

  return (
    <div className="create-view screen-enter">
      <header className="create-header"><button onClick={onClose}><ArrowLeftIcon /></button><strong>发起活动</strong><span>{step}/2</span></header>
      <div className="progress-bar"><i style={{ width: `${step * 50}%` }}></i></div>
      {step === 1 ? <main className="form-body">
        <div className="eyebrow">先决定一起做什么</div><h1>发起一场<br/>你真的想去的活动</h1>
        <label>活动类型</label><div className="choice-row">{['看展','散步','电影','运动'].map((item)=><button key={item} className={category===item?'is-active':''} onClick={()=>setCategory(item)}>{item}</button>)}</div>
        <label htmlFor="title">活动标题</label><input id="title" value={title} onChange={(event)=>setTitle(event.target.value)} placeholder="例如：周日下午，一起去看新展" maxLength={36}/><small className="field-count">{title.length}/36</small>
        <label>活动规模</label><div className="mode-options">
          <button className={mode==='duo'?'is-active':''} onClick={()=>setMode('duo')}><strong>双人同行</strong><span>刚好两个人，专注一次相遇</span></button>
          <button className={mode==='flex'?'is-active':''} onClick={()=>setMode('flex')}><strong>两人成行，可继续招募</strong><span>先出发，再等更多同频的人</span></button>
          <button className={mode==='group'?'is-active':''} onClick={()=>setMode('group')}><strong>多人小组</strong><span>至少 3 人，轻松自然地认识</span></button>
        </div>
      </main> : <main className="form-body">
        <div className="eyebrow">再确定何时何地</div><h1>{title || `${category}活动`}</h1>
        <div className="form-grid"><label>日期<input type="date" defaultValue="2026-08-29"/></label><label>时间<input type="time" defaultValue="15:00"/></label></div>
        <label>活动区域</label><input defaultValue="徐汇滨江 · 公共场所"/>
        <label>预计人均</label><input defaultValue="¥0–100"/>
        <div className="form-summary"><span>{mode==='duo'?'2 人同行':mode==='flex'?'2 人成行 · 可继续招募':'多人小组'}</span><p>参加不代表表达好感，活动后双方同意才会建立长期连接。</p></div>
      </main>}
      <footer className="form-footer">{step===2&&<button className="secondary-action" onClick={()=>setStep(1)}>上一步</button>}<button className="primary-action" disabled={step===1&&!title.trim()} onClick={()=>step===1?setStep(2):setDone(true)}>{step===1?'下一步':'保存活动草稿'}</button></footer>
    </div>
  );
}
