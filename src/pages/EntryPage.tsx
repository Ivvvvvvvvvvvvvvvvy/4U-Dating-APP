import { ArrowRight, Eye, Heart, LogIn, ShieldCheck, Sparkles, UserPlus, UsersRound } from 'lucide-react';

export function EntryPage({ onGuest, onRegister, onLogin }: { onGuest: () => void; onRegister: () => void; onLogin: () => void }) {
  return (
    <section className="entry-page screen-enter" aria-labelledby="entry-title">
      <header className="entry-brand" aria-label="4U">
        <strong>for</strong><span>U</span><i />
      </header>

      <main id="main-content" className="entry-main">
        <div className="entry-visual" aria-hidden="true">
          <span className="entry-avatar entry-avatar--one"><Heart /></span>
          <span className="entry-avatar entry-avatar--two"><UsersRound /></span>
          <span className="entry-spark"><Sparkles /></span>
          <i className="entry-line entry-line--one" />
          <i className="entry-line entry-line--two" />
        </div>

        <div className="entry-copy">
          <span>FOR YOU · FOR US</span>
          <h1 id="entry-title">遇见，不止一种方式。</h1>
          <p>从人、活动与话题出发。你可以先随便看看，也可以用几分钟建立资料，让每一次选择都为下一次遇见提供依据。</p>
        </div>

        <div className="entry-actions" aria-label="选择进入方式">
          <button type="button" className="entry-choice entry-choice--register" onClick={onRegister}>
            <span className="entry-choice-icon"><UserPlus /></span>
            <span><strong>注册并开始建档</strong><small>约 3～5 分钟，可随时退出并继续</small></span>
            <ArrowRight />
          </button>
          <button type="button" className="entry-choice entry-choice--guest" onClick={onGuest}>
            <span className="entry-choice-icon"><Eye /></span>
            <span><strong>以游客身份浏览</strong><small>先看看公开的人气话题与活动</small></span>
            <ArrowRight />
          </button>
          <button type="button" className="entry-choice entry-choice--login" onClick={onLogin}>
            <span className="entry-choice-icon"><LogIn /></span>
            <span><strong>登录</strong><small>已有账号，继续我的资料与消息</small></span>
            <ArrowRight />
          </button>
        </div>

        <div className="entry-trust"><ShieldCheck /><span>首次打开不会自动创建资料，也不会收集你的联系方式</span></div>
      </main>

      <footer className="entry-footer">PEOPLE · EVENTS · TOPICS</footer>
    </section>
  );
}
