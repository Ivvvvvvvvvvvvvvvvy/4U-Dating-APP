import { AlertCircle, CalendarDays, Clock3, MapPin } from 'lucide-react';
import { ParticipationMode, type Activity } from '../domain';
import { Modal } from './Modal';

export function JoinConfirmDialog({ activity, pending, onCancel, onConfirm }: { activity: Activity; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  const openJoin = activity.participationMode === ParticipationMode.OPEN_JOIN;
  const matchFormation = activity.participationMode === ParticipationMode.MATCH_FORMATION;
  return <Modal title={openJoin ? '确认参加活动' : matchFormation ? '确认表达参与意愿' : '确认你的参与申请'} onClose={onCancel} className="confirm-dialog">
    <span className={'type-pill type-pill--' + activity.format.toLowerCase()}>{activity.format === 'PAIR' ? '双人同行' : '多人小组'}</span>
    <p>{openJoin ? '确认后将按最新容量占用席位；若状态发生变化，会请你重新确认。' : matchFormation ? '提交后进入意向池，满足条件后才会组成具体活动；当前不占用席位。' : '提交申请只进入发起者审核，不会立刻占用活动席位，也不代表你向任何成员表达好感。'}</p>
    <div className="confirm-facts"><span><CalendarDays size={17}/>{new Date(activity.schedule.startsAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'})}</span><span><Clock3 size={17}/>{durationLabel(activity)}</span><span><MapPin size={17}/>{activity.publicLocation.district}</span></div>
    <div className="privacy-callout"><AlertCircle size={18}/><span>确认前会重新校验活动状态、招募名额与参与资格。</span></div>
    <button className="primary-button" type="button" disabled={pending} onClick={onConfirm}>{pending ? '正在校验状态…' : openJoin ? '确认参加' : matchFormation ? '确认表达意愿' : '确认并提交申请'}</button>
    <button className="text-button" type="button" onClick={onCancel}>再想想</button>
  </Modal>;
}

function durationLabel(activity: Activity) {
  const minutes = Math.max(0, (new Date(activity.schedule.endsAt).getTime() - new Date(activity.schedule.startsAt).getTime()) / 60_000);
  return '约 ' + (minutes % 60 === 0 ? String(minutes / 60) : (minutes / 60).toFixed(1)) + ' 小时';
}
