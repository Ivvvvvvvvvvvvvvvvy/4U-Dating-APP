import { useState } from 'react';
import { ArrowRight, ChevronLeft, Eye, LockKeyhole, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { signInWithEmail } from '../auth/useAuth';

export function LoginPage({
  onBack,
  onLogin,
  onGoRegister,
}: {
  onBack: () => void;
  onLogin: () => void;
  onGoRegister: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('请输入邮箱和密码');
      return;
    }
    setBusy(true);
    const { error: authError } = await signInWithEmail(email.trim(), password);
    setBusy(false);
    if (authError) {
      setError(authError);
      return;
    }
    onLogin();
  };

  return (
    <section className="entry-page login-page screen-enter" aria-labelledby="login-title">
      <header className="entry-brand" aria-label="4U">
        <strong>for</strong><span>U</span><i />
        <button type="button" className="login-back" aria-label="返回" onClick={onBack}><ChevronLeft size={20} /></button>
      </header>

      <main id="main-content" className="login-main">
        <div className="login-intro">
          <span>WELCOME BACK</span>
          <h1 id="login-title">欢迎回来</h1>
          <p>登录后继续你的资料、活动与话题。</p>
        </div>

        <div className="login-form" aria-label="邮箱登录">
          <label className="field">
            <span>邮箱 <b>必填</b></span>
            <div><Mail size={17} /><input type="email" autoComplete="email" value={email} placeholder="name@example.com" onChange={(event) => setEmail(event.target.value)} /></div>
          </label>
          <label className="field">
            <span>密码 <b>必填</b></span>
            <div><LockKeyhole size={17} /><input type="password" autoComplete="current-password" value={password} placeholder="请输入密码" onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void submit(); }} /></div>
          </label>
          {error && <p className="onboarding-error" role="alert">{error}</p>}
          <button type="button" className="login-submit" disabled={busy} onClick={() => void submit()}>
            {busy ? '登录中…' : '登录'} <ArrowRight size={18} />
          </button>
        </div>

        <div className="login-alt">
          <span>还没有账号？</span>
          <button type="button" onClick={onGoRegister}><UserPlus size={16} />注册并开始建档</button>
          <button type="button" onClick={onLogin}><Eye size={16} />先以游客身份浏览</button>
        </div>

        <div className="entry-trust"><ShieldCheck /><span>登录仅用于账号安全，联系方式不会公开</span></div>
      </main>

      <footer className="entry-footer">PEOPLE · EVENTS · TOPICS</footer>
    </section>
  );
}
