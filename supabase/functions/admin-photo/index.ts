import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw httpError(401, '未登录');

    // Identify the caller from their JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw httpError(401, '登录状态无效');

    // Data work runs with the service-role client (bypasses RLS)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data: profile } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile?.is_admin) throw httpError(403, '仅管理员可访问审核后台');

    const body = await req.json();
    const action = body?.action;

    if (action === 'list') {
      const { data: rows, error } = await admin
        .from('photos')
        .select('id, profile_id, storage_path, bucket, created_at, profiles(display_name)')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true });
      if (error) throw httpError(500, error.message);
      return json({ ok: true, photos: rows ?? [] });
    }

    if (action === 'approve' || action === 'reject') {
      const photoId = String(body?.photoId ?? '');
      if (!photoId) throw httpError(400, '缺少照片 id');

      const { data: photo, error: photoError } = await admin
        .from('photos')
        .select('id, profile_id, bucket, storage_path, status')
        .eq('id', photoId)
        .maybeSingle();
      if (photoError || !photo) throw httpError(404, '照片不存在');
      if (photo.status !== 'PENDING') throw httpError(409, '该照片已审核');

      const now = new Date().toISOString();

      if (action === 'reject') {
        const { error: updateError } = await admin
          .from('photos')
          .update({ status: 'REJECTED', reviewed_at: now, reviewed_by: user.id })
          .eq('id', photoId);
        if (updateError) throw httpError(500, updateError.message);
        await admin.storage.from(photo.bucket).remove([photo.storage_path]);
        return json({ ok: true });
      }

      // Approve: mark approved and append to the public profile photos (dedupe)
      const { data: publicUrlData } = admin.storage.from(photo.bucket).getPublicUrl(photo.storage_path);
      const publicUrl = publicUrlData.publicUrl;

      const { data: ownerProfile } = await admin
        .from('profiles')
        .select('photos')
        .eq('id', photo.profile_id)
        .maybeSingle();

      const current = Array.isArray(ownerProfile?.photos) ? ownerProfile.photos as Array<Record<string, unknown>> : [];
      const next = current.some((item) => item.id === photo.id)
        ? current
        : [...current, { id: photo.id, url: publicUrl, alt: '照片', width: 800, height: 1000 }];

      const { error: updateError } = await admin
        .from('photos')
        .update({ status: 'APPROVED', reviewed_at: now, reviewed_by: user.id })
        .eq('id', photoId);
      if (updateError) throw httpError(500, updateError.message);

      const { error: profileError } = await admin
        .from('profiles')
        .update({ photos: next })
        .eq('id', photo.profile_id);
      if (profileError) throw httpError(500, profileError.message);

      return json({ ok: true, url: publicUrl });
    }

    throw httpError(400, '未知操作');
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 500;
    const message = typeof (error as { message?: unknown })?.message === 'string' ? (error as { message: string }).message : '服务器错误';
    return json({ ok: false, error: message }, status);
  }
});

function httpError(status: number, message: string) {
  return { status, message };
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
