# 后端搭建计划（forU）

## 背景 Context

forU 目前是纯前端应用：所有数据（人物、活动、话题、聊天）来自 `src/mockData.ts` / `src/syntheticPublicData.ts`，状态存 localStorage，注册建档只是本地草稿模拟。Enter Cloud 后端已启用（`src/integrations/supabase/client.ts` 已生成），但数据库 `public` schema 为空，且 `@supabase/supabase-js` 未安装（client.ts 尚未被任何代码引用）。

用户目标：全量迁移到后端（资料、活动、话题、聊天、匹配），分多步完成。登录方式：**邮箱 + 密码**。

## 总体路线图（Roadmap）

| 阶段 | 内容 |
|---|---|
| **Phase 1（本轮）** | 基础设施 + 账号系统：邮箱密码注册/登录、个人资料存入数据库、建档流程真实化 |
| Phase 2 | 内容数据入库：activities / topics / opportunities 建表 + 种子数据，feed 与详情页改读后端 |
| Phase 3 | 用户行为入库：hearts / saves / follows / joins / votes / applications / 创建活动 |
| Phase 4 | 聊天与匹配：threads / messages（realtime）+ 匹配后端函数 + 举报/拉黑 |

本轮只实现 Phase 1，schema 设计为后续阶段预留空间。

---

## Phase 1 详细设计

### 一、后端（Enter Cloud）

1. **安装依赖**：`@supabase/supabase-js`（用 add_dependency）。
2. **认证配置**：调用 `supabase_configure_auth` 开启邮箱注册 + 自动确认（auto-confirm），无需邮件回环即可测试。
3. **Migration A — `public.profiles`**（公共资料，用于发现与展示）：
   - 列：`id uuid PK REFERENCES auth.users(id) ON DELETE CASCADE`、`person_key text UNIQUE`（种子数据保留前端字符串 id 如 `person_lan`）、`display_name text`、`city text`、`occupation text`、`bio text`、`relationship_goal text`、`mbti text`、`zodiac text`、`interests jsonb`、`photos jsonb`、`prompts jsonb`、`verification jsonb`、`profile_status text DEFAULT 'DRAFT'`、`entity_version int DEFAULT 1`、`is_seeded bool DEFAULT false`、`created_at/updated_at timestamptz`
   - RLS 开启 + 策略：所有人可读（发现页需要）、`id = auth.uid()` 可更新自己的资料
   - `handle_new_user` 触发器（security definer）：新用户注册时自动插入一行空 profile
   - `updated_at` 自动更新触发器
4. **Migration B — `public.profile_preferences`**（敏感字段，仅本人可见）：
   - 列：`id uuid PK REFERENCES profiles(id)`、`birth_date date`、`desired_genders jsonb`、`accepted_relationship_goals jsonb`、`candidate_preferences jsonb`、`show_age bool`、`show_zodiac bool`、`show_orientation bool`
   - RLS 开启 + 策略：仅 `id = auth.uid()` 可读可写（隐私：完整生日、候选偏好永不公开）
   - 客户端代码不引用这些字段名（与现有 `check-client-privacy.mjs` 的私有键规则一致）
5. **种子数据**：将 `syntheticPublicData.ts` 中的合成人物写入 `profiles`（`is_seeded=true`、`person_key` 保留），供 Phase 2 读取；本轮 feed 仍用前端 bundle 数据。

### 二、前端

6. **`src/auth/useAuth.ts`**（新增）：会话 Hook。按 auth 规范：
   - 先注册 `onAuthStateChange` 监听再检查已有会话；回调不传 async 函数；回调内的 supabase 调用用 `setTimeout(..., 0)` 延迟
   - 同时保存 user 与 session（刷新后保持登录）
7. **登录/注册 UI**：
   - `src/pages/LoginPage.tsx`（新增）+ 路由 `login`；复用现有 design system 风格
   - `EntryPage`：入口增加"登录"；"注册并开始建档"仍进 onboarding
   - `OnboardingPage` 的 account 步骤：邮箱模式改为真实注册 —— 邮箱 + 密码（+确认密码），调 `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/` } })`；手机号模式本轮保留本地模拟
8. **建档提交**（privacy-preview 步骤的"提交资料审核"）：
   - 把 draft 映射写入 `profiles`（display_name=nickname、city、occupation、bio、interests、mbti、zodiac=由生日派生、prompts、photos 占位）+ `profile_preferences`（birth_date、candidate_preferences、show_age/show_zodiac）
   - 提交成功进入现有 status 页
9. **App.tsx 会话接入**：
   - 用 `useAuth()` 会话；已登录时 `currentUser` 从 `profiles` 读取（替换 mock 的 `currentUser.profile`），游客模式保持 mock
   - 已登录且有资料 → 跳过 entry 直达首页；未登录 → entry
   - `ProfilePage`（me）增加"退出登录"
10. **路由**：`router.ts` 增加 `login` kind；`App.tsx` 渲染 LoginPage

### 关键文件
- 新增：`src/auth/useAuth.ts`、`src/pages/LoginPage.tsx`
- 修改：`src/pages/EntryPage.tsx`、`src/pages/OnboardingPage.tsx`、`src/App.tsx`、`src/router.ts`、`src/pages/ProfilePage.tsx`
- 复用：`src/integrations/supabase/client.ts`（已生成）、现有 design system（styles.css 语义类）
- 后端工具：`supabase_configure_auth`、`supabase_migration`、`supabase_insert`（种子）、`supabase_read_query` / `supabase_get_table_schema`（验证）

---

## Implementation checklist

- [ ] 安装 `@supabase/supabase-js` 依赖
- [ ] `supabase_configure_auth` 开启邮箱注册 + 自动确认
- [ ] Migration A：创建 `profiles` 表，RLS 开启，含读（公开）/写（本人）策略 + 注册触发器 + updated_at 触发器
- [ ] Migration B：创建 `profile_preferences` 表，RLS 开启，仅本人读写
- [ ] 用 `supabase_get_table_schema` 确认两个表 RLS 已启用且策略已列出
- [ ] 种子：合成人物写入 `profiles`（is_seeded=true）
- [ ] `src/auth/useAuth.ts`：会话 Hook（监听先于检查、非 async 回调、setTimeout 延迟调用）
- [ ] `router.ts` 增加 `login` 路由；`App.tsx` 渲染 LoginPage
- [ ] `EntryPage` 增加"登录"入口
- [ ] `OnboardingPage` account 步骤改为真实邮箱+密码注册（signUp + emailRedirectTo）
- [ ] `OnboardingPage` 提交建档时写入 profiles + profile_preferences
- [ ] `App.tsx`：已登录时 currentUser 来自数据库 profile；`ProfilePage` 增加退出登录

## Verification checklist

- [ ] 构建通过：`pnpm run build`（框架执行）无错误
- [ ] 正向：邮箱注册 → 建档提交 → `supabase_read_query` 查到 profiles 新行且 id 对应用户
- [ ] 正向：退出后重新登录（同邮箱+密码），资料正确回显
- [ ] 正向：刷新页面后仍保持登录（session 持久化）
- [ ] 负向：游客浏览模式仍可用（mock 数据正常展示）
- [ ] 负向：他人无法读取我的 `profile_preferences`（RLS 验证）
- [ ] 隐私：客户端产物不含 `birthDate`/`candidatePreferences` 等私有键（`check-client-privacy.mjs` 通过）
