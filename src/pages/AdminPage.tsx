import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Loader2, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { photoPublicUrl } from '../auth/photos';

interface PendingPhoto {
  id: string;
  profile_id: string;
  bucket: string;
  storage_path: string;
  created_at: string;
  display_name?: string | null;
}

interface InvokeResult {
  ok: boolean;
  photos?: PendingPhoto[];
  message?: string;
  denied?: boolean;
}

async function invokeAdmin(body: Record<string, unknown>): Promise<InvokeResult> {
  const { data, error } = await supabase.functions.invoke('admin-photo', { body });
  if (!error) return { ok: true, photos: ((data as { photos?: PendingPhoto[] })?.photos ?? []) as PendingPhoto[] };
  let message = '请求失败，请重试';
  let denied = false;
  try {
    const response = (error as { context?: Response }).context;
    if (response) {
      const parsed = (await response.json()) as { error?: string };
      if (parsed?.error) message = parsed.error;
      if (response.status === 401 || response.status === 403) denied = true;
    }
  } catch {
    /* keep default message */
  }
  return { ok: false, message, denied };
}

export function AdminPage({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<'loading' | 'denied' | 'ready'>('loading');
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [deniedMessage, setDeniedMessage] = useState('');

  const load = useCallback(async () => {
    setPhase('loading');
    const result = await invokeAdmin({ action: 'list' });
    if (!result.ok) {
      setDeniedMessage(result.message ?? '无权限');
      setPhase('denied');
      return;
    }
    setPhotos(result.photos ?? []);
    setPhase('ready');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (photoId: string, action: 'approve' | 'reject') => {
    setBusyId(photoId);
    setNotice('');
    const result = await invokeAdmin({ action, photoId });
    setBusyId(null);
    if (!result.ok) {
      if (result.denied) {
        setDeniedMessage(result.message ?? '无权限');
        setPhase('denied');
        return;
      }
      // 409 等业务冲突（照片已被处理）：刷新列表保持一致
      setNotice(result.message ?? '操作失败，请重试');
      void load();
      return;
    }
    setPhotos((current) => current.filter((photo) => photo.id !== photoId));
    setNotice(action === 'approve' ? '已通过，照片已公开展示' : '已拒绝，照片已删除');
  };

  return (
    <section className="page admin-page screen-enter" aria-labelledby="admin-title">
      <header className="page-header admin-header">
        <button type="button" className="icon-button" aria-label="返回" onClick={onBack}><ArrowLeft size={20}/></button>
        <div><span>管理员</span><h1 id="admin-title">照片审核后台</h1></div>
      </header>

      {phase === 'loading' && (
        <div className="admin-state"><Loader2 className="is-spinning"/><p>加载待审照片…</p></div>
      )}

      {phase === 'denied' && (
        <div className="admin-state">
          <ShieldAlert size={26}/>
          <h2>无法访问审核后台</h2>
          <p>{deniedMessage}。请使用管理员账号登录后重试。</p>
          <button type="button" className="secondary-button" onClick={onBack}>返回</button>
        </div>
      )}

      {phase === 'ready' && (
        <>
          {notice && <p className="admin-notice" role="status">{notice}</p>}
          {photos.length === 0 ? (
            <div className="admin-state"><ShieldCheck size={26}/><h2>暂无待审照片</h2><p>新的上传会出现在这里。</p></div>
          ) : (
            <ul className="admin-list">
              {photos.map((photo) => (
                <li className="admin-photo-card" key={photo.id}>
                  <img src={photoPublicUrl(photo.bucket ?? 'profile-photos', photo.storage_path)} alt="待审照片" />
                  <div>
                    <strong>{photo.display_name || '未命名用户'}</strong>
                    <span>上传于 {new Date(photo.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="admin-actions">
                    <button type="button" className="admin-approve" disabled={busyId !== null} onClick={() => void review(photo.id, 'approve')}>{busyId === photo.id ? <Loader2 className="is-spinning"/> : <Check size={16}/>}通过</button>
                    <button type="button" className="admin-reject" disabled={busyId !== null} onClick={() => void review(photo.id, 'reject')}>{busyId === photo.id ? <Loader2 className="is-spinning"/> : <X size={16}/>}拒绝</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
