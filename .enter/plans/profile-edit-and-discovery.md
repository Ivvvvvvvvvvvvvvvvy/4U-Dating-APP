# 个人资料编辑 + 真实用户进入推荐池 计划

## 背景 Context

用户反馈两点：
1. **资料不可编辑**：「我的」页个人资料的「编辑」按钮目前只是占位提示（`setMessage('资料编辑功能即将开放')`），注册/建档时填写的资料无法修改。
2. **真实用户未进推荐池**：目前首页「推荐」流与「寻觅」页的 feed 全部来自前端内置的 49 个合成人物（`syntheticPublicData.ts` / `mockData.ts`），真实注册用户**从不出现**。

用户决策：
- 真实用户**至少有一张照片审核通过后**（即 `profiles.photos` 非空）才进入推荐池，符合现有「审核通过后进入推荐池」文案。
- 展示位置：**首页「推荐」流 + 「寻觅」页**。
- 本人不出现在自己的推荐流中。

## 设计

### 一、个人资料编辑

1. **`src/auth/profile.ts` 新增 `saveProfileEdit(userId, payload)`**：
   - 更新 `profiles`：`display_name`、`city`、`occupation`、`bio`、`relationship_goal`、`mbti`、`zodiac`（由 `profile_preferences.birth_date` 派生）、`interests`、`prompts`（更新第 0 项答案，保留默认 prompt 文案）；
   - **不覆盖** `photos`、`verification`、`profile_status`（编辑不降级推荐资格）；
   - 更新 `profile_preferences`：`show_age`、`show_zodiac`、`show_orientation`；
   - 成功后由调用方（App.tsx）重新 `loadUserProfile` 刷新 `dbProfile`。
2. **新增 `src/pages/ProfileEditPage.tsx`**（路由 `/me/edit`）：
   - 从 `dbProfile`（person + preferences）预填当前值；
   - 字段：昵称、城市、职业、自我介绍（bio）、关系意图（单选，复用 6 意图文案映射到 RelationshipGoal）、MBTI（单选网格）、兴趣（最多 5 个 chips，自带兴趣标签列表）、隐私开关（公开年龄/星座/性取向，复用 `toggle-row`）、Prompt 回答（textarea）；
   - 保存按钮 → `saveProfileEdit` → 成功提示 → 返回 `/me/profile`；
   - 复用 onboarding 样式类（`field`、`choice-chips`、`mbti-grid`、`interest-cloud`、`toggle-row`、`onboarding-primary` 等），`styles.css` 补充少量编辑页样式。
3. **`src/App.tsx` 接线**：
   - `onEditProfile` → `go('/me/edit')`（替换占位 toast）；
   - `onEditRelationship` 同样指向编辑页；
   - `/me/edit` 渲染 `ProfileEditPage`；`routeTab` 归入 `me`。

### 二、真实用户进入推荐池

1. **新增 `src/auth/discovery.ts`**：
   - `loadRecommendablePeople(excludeId?: string)`：查询 `profiles`（`is_seeded = false`、`display_name` 非空、`photos` jsonb 非空数组）并关联 `profile_preferences`（`birth_date` 计算年龄），用现有 `profileRowToPerson` 转成 `Person[]`，排除 `excludeId`；
   - `buildUserFeedCard(person)`：按合成卡片模板构造 `PersonFeedCard`——
     - `reason`：`SHARED_INTEREST`，headline 取前两个兴趣（如「可以从 City Walk 聊起」），`evidenceLabels` 取前 2 个兴趣；
     - `presentation`：`PERSON_PORTRAIT`，封面图用 `person.photos[0]`，`eyebrow: '资料完整'`，headline `姓名，年龄`，`supportingText: 职业 · 城市`，badges 前 2 个兴趣，facts `[想认识: 关系意图文案]`，`primaryActionLabel: '表达红心'`；
     - `allowedActions: ['VIEW_DETAIL','HEART_PERSON','HIDE','REPORT']`；
   - 返回 `{ people: Person[], cards: PersonFeedCard[] }`。
2. **`src/App.tsx`**：
   - 登录且 `dbProfile` 就绪后加载 `loadRecommendablePeople(auth.user.id)`，存 `realDiscovery` state（含 people + cards）；
   - `cardActions.resolveEntity` 增加兜底：先查 mock，查不到再查 `realDiscovery.people`；
   - `HomePage` 传新 prop `extraPersonFeedCards={realDiscovery.cards}`；`DiscoverPage` 传 `cards={[...personFeed, ...realDiscovery.cards]}`；
   - 详情页：`const person = findPersonById(route.id) ?? findRealPerson(route.id)`。
3. **`src/pages/HomePage.tsx`**：新增 prop `extraPersonFeedCards?: readonly PersonFeedCard[]`，`createRecommendationFeed` 的 people 池改为 `[...personFeed, ...(extraPersonFeedCards ?? [])]`。

### 关系意图文案（facts「想认识」）
`LONG_TERM→寻找长期关系`、`SERIOUS_DATING→认真约会`、`OPEN_TO_EXPLORE→开放探索`（与 ProfilePage 现有 `relationshipLabels` 一致，抽为共享常量或本地复制）。

### 关键文件
- 新增：`src/auth/discovery.ts`、`src/pages/ProfileEditPage.tsx`
- 修改：`src/auth/profile.ts`、`src/App.tsx`、`src/pages/HomePage.tsx`、`src/pages/DiscoverPage.tsx`、`src/styles.css`
- 复用：`profileRowToPerson`、`zodiacFromBirthDate`、onboarding 样式类、`personFeed`/`createRecommendationFeed`

---

## Implementation checklist

- [ ] `src/auth/profile.ts`：新增 `saveProfileEdit(userId, payload)`（profiles 公开字段 + preferences 隐私开关，不覆盖 photos/verification/profile_status）
- [ ] `src/pages/ProfileEditPage.tsx`：路由 `/me/edit`，从 dbProfile 预填，含昵称/城市/职业/bio/关系意图/MBTI/兴趣/隐私开关/Prompt，保存后返回 `/me/profile`
- [ ] `src/App.tsx`：`onEditProfile`/`onEditRelationship` 跳转 `/me/edit`；渲染 ProfileEditPage；保存成功后刷新 dbProfile
- [ ] `src/auth/discovery.ts`：`loadRecommendablePeople(excludeId)`（非种子 + display_name 非空 + photos 非空）+ `buildUserFeedCard(person)` + `{ people, cards }`
- [ ] `src/App.tsx`：加载 realDiscovery（排除本人）；`resolveEntity` 与详情页 `findPersonById ?? realPeople` 兜底
- [ ] `src/pages/HomePage.tsx`：新增 `extraPersonFeedCards` prop 并入推荐 people 池
- [ ] `src/App.tsx`：HomePage 传 `extraPersonFeedCards`；DiscoverPage 传 `cards=[...personFeed, ...realCards]`
- [ ] `src/styles.css`：编辑页少量样式
- [ ] 隐私检查：客户端产物不含私有键（`check-client-privacy.mjs` 通过）

## Verification checklist

- [ ] 构建链全绿：`tsc -b` + `vite build` + `check-client-privacy.mjs` + `package-site.sh`
- [ ] 正向：登录后 `/me/profile` → 点「编辑」→ 修改昵称/职业/兴趣 → 保存 → 返回后资料立即更新（dbProfile 刷新）
- [ ] 正向：修改隐私开关后，个人卡年龄/星座显示随之变化
- [ ] 正向：拥有≥1 张审核通过照片的真实用户，出现在首页「推荐」流与「寻觅」页（`supabase_read_query` 确认 profiles.photos 非空）
- [ ] 正向：点击真实用户卡片可打开详情页（`/people/{id}`）
- [ ] 负向：本人不出现在自己的推荐流（excludeId 生效）
- [ ] 负向：未通过任何照片的用户（photos 为空）不进入推荐池
- [ ] 负向：游客（未登录）仍显示合成人物 feed，不受影响
