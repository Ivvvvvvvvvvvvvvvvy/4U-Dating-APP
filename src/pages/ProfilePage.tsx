import { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  FilePenLine,
  HeartHandshake,
  ImagePlus,
  KeyRound,
  LockKeyhole,
  MapPin,
  Repeat,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { RelationshipGoal, VerificationStatus, type CurrentUser } from '../domain';
import { SafeImage } from '../components/SafeImage';
import { loadMyPhotos, photoPublicUrl, removePendingPhoto, uploadProfilePhoto, type PhotoRow } from '../auth/photos';

export type ProfileSection = 'profile' | 'relationship' | 'assets' | 'permissions';
export type ProfileAssetKey = 'saved' | 'active' | 'applications' | 'drafts';
export type ProfilePermissionTier = 'PUBLIC' | 'CONNECTIONS' | 'CONFIRMED_ACTIVITY' | 'PRIVATE';

export interface ProfileAssetCounts {
  readonly saved: number;
  readonly active: number;
  readonly applications: number;
  readonly drafts: number;
}

export interface ProfilePageProps {
  readonly section: string;
  readonly user: CurrentUser;
  readonly assets?: Partial<ProfileAssetCounts>;
  readonly onSectionChange: (section: ProfileSection) => void;
  readonly onEditProfile?: () => void;
  readonly onEditRelationship?: () => void;
  readonly onOpenAsset?: (asset: ProfileAssetKey) => void;
  readonly onOpenPermission?: (tier: ProfilePermissionTier) => void;
  readonly onSwitchAccount?: () => void;
  readonly userId?: string;
  readonly isAdmin?: boolean;
  readonly onOpenAdmin?: () => void;
}

const sectionItems: readonly {
  id: ProfileSection;
  label: string;
  description: string;
  icon: typeof UserRound;
}[] = [
  { id: 'profile', label: '个人资料', description: '公开展示与认证状态', icon: UserRound },
  { id: 'relationship', label: '关系意图', description: '想建立怎样的连接', icon: HeartHandshake },
  { id: 'assets', label: '我的资产', description: '收藏、活动与草稿', icon: Bookmark },
  { id: 'permissions', label: '权限分级', description: '谁可以看到什么', icon: KeyRound },
];

const relationshipLabels: Record<RelationshipGoal, { title: string; description: string }> = {
  [RelationshipGoal.LONG_TERM]: { title: '寻找长期关系', description: '愿意以稳定、持续了解为方向建立关系。' },
  [RelationshipGoal.SERIOUS_DATING]: { title: '认真约会', description: '希望从真实见面开始，认真判断彼此是否合适。' },
  [RelationshipGoal.OPEN_TO_EXPLORE]: { title: '开放探索', description: '不预设唯一结果，但会清楚表达边界与节奏。' },
};

export function ProfilePage({
  section,
  user,
  assets,
  onSectionChange,
  onEditProfile,
  onEditRelationship,
  onOpenAsset,
  onOpenPermission,
  onSwitchAccount,
  userId,
  isAdmin,
  onOpenAdmin,
}: ProfilePageProps) {
  const activeSection = isProfileSection(section) ? section : 'profile';
  const counts: ProfileAssetCounts = {
    saved: assets?.saved ?? user.stats.savedActivityCount,
    active: assets?.active ?? user.stats.activeActivityCount,
    applications: assets?.applications ?? 0,
    drafts: assets?.drafts ?? 0,
  };
  const profile = user.profile;

  return (
    <section className="page profile-page screen-enter" aria-labelledby="profile-name" data-screen-label="用户资料">
      <header className="profile-cover">
        <div className="profile-identity">
          <SafeImage src={profile.photos[0].url} alt={profile.photos[0].alt} ratio="1 / 1" fallbackLabel="头像" />
          <div>
            <span>{verificationLabel(profile.verification.personhood)}</span>
            <h1 id="profile-name">{profile.displayName}</h1>
            <p>{profile.city} · {profile.occupation} · {relationshipLabels[profile.relationshipGoal].title}</p>
          </div>
        </div>
      </header>

      <nav className="profile-section-nav" aria-label="我的页面分区">
        {sectionItems.map(({ id, label, description, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={activeSection === id ? 'is-active' : ''}
            aria-current={activeSection === id ? 'page' : undefined}
            onClick={() => onSectionChange(id)}
          >
            <Icon size={19} />
            <span><strong>{label}</strong><small>{description}</small></span>
            <ChevronRight size={17} />
          </button>
        ))}
      </nav>

      <main className="profile-section-content">
        {activeSection === 'profile' && <ProfileOverview user={user} onEdit={onEditProfile} userId={userId} />}
        {activeSection === 'relationship' && <RelationshipOverview user={user} onEdit={onEditRelationship} />}
        {activeSection === 'assets' && <AssetOverview counts={counts} onOpen={onOpenAsset} />}
        {activeSection === 'permissions' && <PermissionOverview user={user} onOpen={onOpenPermission} />}
      </main>
      <div className="profile-account-actions">
        {isAdmin && onOpenAdmin && <button type="button" className="admin-button" onClick={onOpenAdmin}><ShieldCheck size={17} />审核后台</button>}
        {onSwitchAccount && <button type="button" className="logout-button" onClick={onSwitchAccount}><Repeat size={17}/>切换账号</button>}
      </div>
    </section>
  );
}

function ProfileOverview({ user, onEdit, userId }: { user: CurrentUser; onEdit?: () => void; userId?: string }) {
  const profile = user.profile;
  return (
    <>
      <section className="profile-section">
        <div className="section-heading"><h2>公开资料</h2>{onEdit && <button type="button" onClick={onEdit}>编辑</button>}</div>
        <p className="profile-bio">{profile.bio}</p>
        <dl className="profile-facts">
          <div><dt>城市</dt><dd>{profile.city}</dd></div>
          <div><dt>职业</dt><dd>{profile.occupation}</dd></div>
          <div><dt>年龄</dt><dd>{user.privacy.showAge ? `${profile.age} 岁` : '未公开'}</dd></div>
          <div><dt>MBTI</dt><dd>{profile.mbti}</dd></div>
        </dl>
      </section>
      <PhotoManager userId={userId} approved={profile.photos} />
      <section className="profile-section">
        <div className="section-heading"><h2>兴趣坐标</h2><span>{profile.interests.length} 项</span></div>
        <div className="interest-cloud">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>
      </section>
      <section className="profile-section verification-summary">
        <div className="section-heading"><h2>资料可信度</h2></div>
        <StatusLine label="账户验证" complete={profile.verification.account === VerificationStatus.VERIFIED} />
        <StatusLine label="真人验证" complete={profile.verification.personhood === VerificationStatus.VERIFIED} />
        <StatusLine label="资料审核" complete={profile.verification.profileReview === VerificationStatus.VERIFIED} />
      </section>
    </>
  );
}

function RelationshipOverview({ user, onEdit }: { user: CurrentUser; onEdit?: () => void }) {
  const intent = relationshipLabels[user.profile.relationshipGoal];
  return (
    <>
      <section className="profile-section relationship-card">
        <div className="section-heading"><h2>当前关系意图</h2>{onEdit && <button type="button" onClick={onEdit}>调整</button>}</div>
        <HeartHandshake size={28} />
        <h3>{intent.title}</h3>
        <p>{intent.description}</p>
      </section>
      <section className="profile-section">
        <div className="section-heading"><h2>使用方式</h2></div>
        <p className="profile-bio">关系意图用于公开表达你希望建立的连接，也会参与推荐说明。它不是承诺，不替你向任何人表达好感。</p>
        <StatusLine label="AI 兼容性分析" complete={user.consent.aiCompatibility} />
        <StatusLine label="公开推荐说明" complete={user.consent.publicExplanation} />
        <small className="consent-version">授权条款 · {new Date(user.consent.updatedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}更新</small>
      </section>
    </>
  );
}

function AssetOverview({ counts, onOpen }: { counts: ProfileAssetCounts; onOpen?: (asset: ProfileAssetKey) => void }) {
  const items: readonly { id: ProfileAssetKey; label: string; description: string; count: number; icon: typeof Bookmark }[] = [
    { id: 'saved', label: '收藏的活动', description: '稍后再决定是否申请', count: counts.saved, icon: Bookmark },
    { id: 'active', label: '进行中的活动', description: '已确认或正在参与', count: counts.active, icon: UsersRound },
    { id: 'applications', label: '活动申请', description: '审核、候补与席位状态', count: counts.applications, icon: ClipboardList },
    { id: 'drafts', label: '活动草稿', description: '仅自己可见，提交后进入审核', count: counts.drafts, icon: FilePenLine },
  ];
  return (
    <section className="settings-list asset-list" aria-label="我的资产">
      {items.map(({ id, label, description, count, icon: Icon }) => (
        <button key={id} type="button" onClick={() => onOpen?.(id)} disabled={!onOpen}>
          <Icon size={20} />
          <span><strong>{label}</strong><small>{description}</small></span>
          <b>{count}</b>
          <ChevronRight size={18} />
        </button>
      ))}
    </section>
  );
}

function PermissionOverview({ user, onOpen }: { user: CurrentUser; onOpen?: (tier: ProfilePermissionTier) => void }) {
  const tiers: readonly {
    id: ProfilePermissionTier;
    label: string;
    audience: string;
    details: string;
    icon: typeof Eye;
  }[] = [
    { id: 'PUBLIC', label: '公开资料', audience: '所有可见用户', details: `城市、职业、兴趣；年龄${user.privacy.showAge ? '公开' : '隐藏'}，星座${user.privacy.showZodiac ? '公开' : '隐藏'}`, icon: Eye },
    { id: 'CONNECTIONS', label: '连接后可见', audience: '双向连接与会话成员', details: '会话内容和连接上下文；消息不会向公开资料展示', icon: HeartHandshake },
    { id: 'CONFIRMED_ACTIVITY', label: '确认参与后可见', audience: '同场确认参与者', details: `${user.privacy.showInConfirmedParticipantLists ? '允许出现在参与者列表' : '不展示在参与者列表'}；集合点仅向确认者开放`, icon: MapPin },
    { id: 'PRIVATE', label: '仅自己与账户', audience: '仅自己可管理', details: `授权记录、账户验证；锁屏消息预览${user.privacy.lockScreenMessagePreview === 'HIDDEN' ? '已隐藏' : '按系统设置'}`, icon: LockKeyhole },
  ];

  return (
    <>
      <section className="profile-section permission-intro">
        <ShieldCheck size={24} />
        <div><h2>按关系与场景逐级开放</h2><p>公开资料、连接会话、活动现场和账户信息使用不同权限，不因推荐或报名自动扩大。</p></div>
      </section>
      <section className="permission-tiers">
        {tiers.map(({ id, label, audience, details, icon: Icon }, index) => (
          <button key={id} type="button" className="permission-tier" onClick={() => onOpen?.(id)} disabled={!onOpen}>
            <span className="permission-level">0{index + 1}</span>
            <Icon size={20} />
            <span><strong>{label}</strong><small>{audience}</small><p>{details}</p></span>
            {onOpen ? <ChevronRight size={18} /> : id === 'PUBLIC' ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>
        ))}
      </section>
    </>
  );
}

function StatusLine({ label, complete }: { label: string; complete: boolean }) {
  return <div className="profile-status-line">{complete ? <CheckCircle2 size={17} /> : <Sparkles size={17} />}<span>{label}</span><strong>{complete ? '已开启' : '未开启'}</strong></div>;
}

function verificationLabel(status: VerificationStatus) {
  if (status === VerificationStatus.VERIFIED) return '资料已校验';
  if (status === VerificationStatus.PENDING) return '真人认证审核中';
  if (status === VerificationStatus.FAILED) return '真人认证未通过';
  return '真人尚未认证';
}

function PhotoManager({ userId, approved }: { userId?: string; approved: CurrentUser['profile']['photos'] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PhotoRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void loadMyPhotos(userId)
      .then((rows) => { if (!cancelled) setPending(rows.filter((row) => row.status === 'PENDING')); })
      .catch(() => { if (!cancelled) setError('照片加载失败'); });
    return () => { cancelled = true; };
  }, [userId]);

  const onFiles = async (files: FileList | null) => {
    if (!userId || !files?.length) return;
    setBusy(true);
    setError('');
    try {
      const created: PhotoRow[] = [];
      for (const file of Array.from(files)) created.push(await uploadProfilePhoto(userId, file));
      setPending((current) => [...current, ...created]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '上传失败，请重试');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onRemove = async (photo: PhotoRow) => {
    setBusy(true);
    setError('');
    try {
      await removePendingPhoto(photo);
      setPending((current) => current.filter((row) => row.id !== photo.id));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : '删除失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const total = approved.length + pending.length;

  return (
    <section className="profile-section photo-manager">
      <div className="section-heading"><h2>照片管理</h2><span>{total}/6</span></div>
      <p className="profile-bio">从手机或电脑上传照片，通过审核后才会公开展示。</p>
      <div className="photo-grid">
        {approved.map((asset, index) => (
          <div className="photo-cell is-filled" key={asset.id}>
            <img src={asset.url} alt={asset.alt} />
            <em className="photo-cover">{index === 0 ? '封面' : `照片 ${index + 1}`}</em>
          </div>
        ))}
        {pending.map((photo) => (
          <div className="photo-cell is-filled" key={photo.id}>
            <img src={photoPublicUrl(photo.bucket, photo.storage_path)} alt="待审核照片" />
            <span className="photo-badge">待审核</span>
            <button type="button" className="photo-remove" aria-label="删除待审核照片" onClick={() => void onRemove(photo)}><X size={14}/></button>
          </div>
        ))}
        {total < 6 && (
          <button type="button" className="photo-add" disabled={busy || !userId} onClick={() => inputRef.current?.click()}>
            {busy ? <><span>上传中…</span></> : <><ImagePlus/><span>添加照片</span></>}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(event) => void onFiles(event.target.files)} />
      {error && <p className="photo-manager-error" role="alert">{error}</p>}
      {!userId && <p className="photo-manager-error">登录后可上传照片</p>}
    </section>
  );
}

function isProfileSection(value: string): value is ProfileSection {
  return sectionItems.some((item) => item.id === value);
}
