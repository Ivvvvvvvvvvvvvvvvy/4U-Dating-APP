# 照片上传 + 审核后台 计划（forU Phase 1.5）

## 背景 Context

- Phase 1 已完成：邮箱+密码注册/登录，`profiles` / `profile_preferences` 已入库（见 `backend-migration-phase1.md`）。当前 Onboarding 的 photos 步骤只是占位计数（`photoCount` 0-6），没有任何真实上传；`profiles.photos` jsonb 始终为空，个人卡显示 `PLACEHOLDER_PHOTO`。
- 用户需求：
  1. 支持从用户电脑/手机本地选择照片上传；
  2. 做一个简单的审核后台（列出待审照片，支持通过/拒绝）。
- 管理员账号：**邮箱 `2010987761@qq.com` 注册的账号自动成为管理员**（仅管理员可审核）。

## 设计

### 一、后端（Enter Cloud）

**1. 一个 Migration（`supabase_migration`）**，包含：

- `public.profiles` 增加列 `is_admin boolean not null default false`；
- 更新 `handle_new_user` 触发器：注册邮箱为 `2010987761@qq.com` 时 `is_admin = true`；
- 新增 `public.is_admin(uid uuid)` 安全定义者函数（供 RLS 策略复用，无递归）；
- 新增 `public.photos` 表：
  - `id uuid PK default gen_random_uuid()`、`profile_id uuid not null references public.profiles(id) on delete cascade`、`bucket text not null default 'profile-photos'`、`storage_path text not null`、`status text not null default 'PENDING'`（PENDING/APPROVED/REJECTED）、`created_at timestamptz default now()`、`reviewed_at timestamptz`、`reviewed_by uuid`
  - **RLS 开启** + 策略：
    - `photos_owner_select`：本人可读自己的（任意状态）
    - `photos_approved_read`：所有人可读 `status='APPROVED'`
    - `photos_admin_select` / `photos_admin_update`：`public.is_admin(auth.uid())` 可读全部、可改状态
    - `photos_owner_insert`：`auth.uid() = profile_id` 可插入
    - `photos_owner_delete`：本人可删除自己的记录
- 存储桶 `profile-photos`（public，10MB，仅图片 jpg/png/webp/gif）+ `storage.objects` 策略：
  - `profile_photos_read_public`：select to public（bucket 内）
  - `profile_photos_insert_owner` / `update_owner` / `delete_owner`：`authenticated`，路径首段 = `auth.uid()::text`（`storage.foldername(name)[1]`）

**2. 后端函数 `admin-photo`**（`supabase/functions/admin-photo/index.ts`，用 `supabase_deploy_edge_function` 部署）：
- CORS 按规范（OPTIONS 预检 + 响应头）；`supabase/config.toml` 增加 `[functions.admin-photo] verify_jwt = true`；
- 用请求 `Authorization` 构造用户客户端 → `getUser()` 取 `uid`；service role 客户端执行数据操作；
- 校验：service role 查 `profiles.is_admin`，非管理员返回 403；
- `{ action: 'list' }` → 返回待审照片列表（含 `display_name`、`storage_path`、`created_at`）；
- `{ action: 'approve', photoId }` → `photos.status='APPROVED'` + 写 `reviewed_at/reviewed_by`，并把 `{id, url(公开地址), alt, width, height}` 追加进对应 `profiles.photos` jsonb（去重）；
- `{ action: 'reject', photoId }` → `photos.status='REJECTED'` + 删除 storage 对象；
- 全部走 supabase-js 查询方法，不写裸 SQL。

### 二、前端

1. **`src/auth/profile.ts`**：`profileRowToPerson` 把 `profiles.photos` jsonb 映射为 `MediaAsset[]`（空则回退 `PLACEHOLDER_PHOTO`），审核通过后个人卡即显示真实照片。
2. **`src/auth/photos.ts`（新增）**：
   - `uploadProfilePhoto(userId, file)`：校验（图片类型、≤10MB）→ **canvas 重编码去 EXIF/定位信息并压到最长边 1600px** → 上传 `profile-photos/{userId}/{uuid}.{ext}` → 插入 `photos` 行（PENDING）→ 返回行；
   - `loadMyPhotos(userId)`：查本人 `photos` 行；
   - `removePendingPhoto(photoRow)`：删 storage 对象 + 删行（仅 PENDING）。
3. **`src/pages/OnboardingPage.tsx`**：重写 `Photos` 步骤 —— 6 格网格：已上传格显示缩略图（公开 URL）+ PENDING 标记 + 删除（仅待审）；空格为隐藏 file input（`accept="image/*"`）。上传/删除后同步 `draft.photoCount`（继续门槛保持 ≥2，personhood 卡不变）。上传前先 `supabase.auth.getUser()` 取 userId。
4. **`src/pages/ProfilePage.tsx`**：`个人资料` 分区增加「照片管理」卡片：展示已通过照片（来自 `profiles.photos`）+ 待审照片（状态徽标），提供「添加照片」与待审删除；新增 `userId`、`isAdmin` props。
5. **`src/pages/AdminPage.tsx`（新增）**：路由 `/admin`。挂载时 invoke `admin-photo {action:'list'}`：失败（403/未登录）→「无权限/请先登录」页；成功 → 待审照片卡片（缩略图 + 上传者 + 时间 + 通过/拒绝按钮，操作后刷新列表）。空状态「暂无待审照片」。
6. **`src/router.ts`**：新增 `admin` 路由 kind → `/admin`；`routeTab` 归入 `me` 高亮。
7. **`src/App.tsx`**：`loadUserProfile` 返回 `isAdmin`（读 `profiles.is_admin`），随 `dbProfile` 传递；`ProfilePage` 传 `userId`/`isAdmin`，管理员才显示「审核后台」入口（跳 `/admin`）；渲染 `AdminPage`。
8. **`src/styles.css`**：补充照片状态徽标、管理卡片、审核列表少量样式（复用 `photo-grid` 语义类）。

### 关键文件
- 后端：`supabase/functions/admin-photo/index.ts`、`supabase/config.toml`、迁移文件（工具生成）
- 前端：`src/auth/photos.ts`（新）、`src/pages/AdminPage.tsx`（新）、`src/auth/profile.ts`、`src/pages/OnboardingPage.tsx`、`src/pages/ProfilePage.tsx`、`src/router.ts`、`src/App.tsx`、`src/styles.css`
- 工具：`supabase_migration`、`supabase_deploy_edge_function`、`supabase_get_table_schema`、`supabase_read_query`、`supabase_search_edge_function_logs`

---

## Implementation checklist

- [ ] Migration：`profiles.is_admin` 列 + `handle_new_user` 对 `2010987761@qq.com` 置管理员 + `public.is_admin(uid)` 函数
- [ ] Migration：`photos` 表 + RLS + 5 条策略
- [ ] Migration：`profile-photos` 存储桶 + `storage.objects` 4 条策略
- [ ] `supabase_get_table_schema` 确认 `photos` RLS 已启用且策略列出
- [ ] 编写 `supabase/functions/admin-photo/index.ts`（list/approve/reject + CORS + is_admin 校验）
- [ ] `config.toml` 增加 `[functions.admin-photo] verify_jwt = true`，`supabase_deploy_edge_function` 部署
- [ ] `src/auth/profile.ts`：photos jsonb → `MediaAsset[]`（空回退占位）
- [ ] `src/auth/photos.ts`：`uploadProfilePhoto`（canvas 去 EXIF/压缩）、`loadMyPhotos`、`removePendingPhoto`
- [ ] `OnboardingPage` Photos 步骤改为真实上传网格（file input、缩略图、删除、同步 photoCount）
- [ ] `ProfilePage`：「照片管理」卡片 + `userId`/`isAdmin` props + 管理员「审核后台」入口
- [ ] `AdminPage`：列表 + 通过/拒绝 + 无权限/空状态
- [ ] `router.ts` admin 路由；`App.tsx` 接线（isAdmin 传递、AdminPage 渲染）

## Verification checklist

- [ ] 构建链全绿：`tsc -b` + `vite build` + `check-client-privacy.mjs` + `package-site.sh`
- [ ] 正向：注册新账号 → 建档 photos 步骤从本机选图上传 → `supabase_read_query` 查到 `photos` 行（PENDING）+ storage 对象存在
- [ ] 正向：`2010987761@qq.com` 登录 → `/admin` 看到待审照片 → 通过 → `photos.status=APPROVED` 且 `profiles.photos` 已追加（read_query 验证）
- [ ] 正向：审核通过后，个人卡/详情页展示真实照片（不再显示占位头像）
- [ ] 正向：拒绝后 `photos.status=REJECTED` 且 storage 对象被删除
- [ ] 负向：非管理员访问 `/admin` 显示无权限（后端函数 403）
- [ ] 负向：未登录/游客无法插入 `photos` 行（RLS）
- [ ] 边界：超过 10MB 或非图片文件被前端拦截并提示
- [ ] 隐私：上传对象不带 EXIF（canvas 重编码后无定位信息）
