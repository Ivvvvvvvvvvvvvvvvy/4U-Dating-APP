import { supabase } from '../integrations/supabase/client';
import type { Database } from '../integrations/supabase/types';

export type PhotoRow = Database['public']['Tables']['photos']['Row'];

export const PHOTO_BUCKET = 'profile-photos';
export const MAX_PHOTOS = 6;
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function photoPublicUrl(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export function validatePhotoFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return '仅支持 JPG / PNG / WEBP / GIF 图片';
  if (file.size > MAX_SIZE_BYTES) return '图片大小不能超过 10MB';
  return null;
}

/**
 * Re-encode the image through a canvas so EXIF/GPS data is stripped and the
 * long edge is capped at 1600px before it reaches storage.
 */
async function normalizeImageFile(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('无法处理图片');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('图片处理失败'))), 'image/jpeg', 0.85);
  });
}

/**
 * Upload a locally picked photo: validate → strip EXIF/downscale → push the
 * object into `profile-photos/{userId}/` → insert a PENDING row in `photos`.
 */
export async function uploadProfilePhoto(userId: string, file: File): Promise<PhotoRow> {
  const validationError = validatePhotoFile(file);
  if (validationError) throw new Error(validationError);

  const blob = await normalizeImageFile(file);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from('photos')
    .insert({ profile_id: userId, bucket: PHOTO_BUCKET, storage_path: path, status: 'PENDING' })
    .select()
    .single();
  if (insertError || !data) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw insertError ?? new Error('照片记录创建失败');
  }
  return data;
}

export async function loadMyPhotos(userId: string): Promise<PhotoRow[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('profile_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Remove a photo that is still pending review (row first, then object). */
export async function removePendingPhoto(photo: PhotoRow): Promise<void> {
  if (photo.status !== 'PENDING') throw new Error('已审核的照片暂不支持删除');
  const { error } = await supabase.from('photos').delete().eq('id', photo.id).eq('profile_id', photo.profile_id);
  if (error) throw error;
  await supabase.storage.from(photo.bucket).remove([photo.storage_path]);
}
