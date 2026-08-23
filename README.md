<div align="center">

# for U · 4U

### 从共同兴趣、活动计划和有边界的对话开始认识彼此

4U 是一款面向成年用户的社交发现产品原型。它把人物、活动与话题放进同一条探索路径，让用户先从共同兴趣和具体情境开始，再决定是否继续认识彼此。

[在线体验](https://happyeye1.github.io/4U/) · [产品体验](#产品体验) · [技术架构](#技术架构) · [本地运行](#本地运行)

</div>

![4U 桌面端综合推荐页](./docs/assets/readme/home-desktop.jpg)

> **当前状态**
>
> GitHub Pages 展示的是可交互的静态产品原型，使用成年虚构人物、活动与话题数据。仓库同时包含可独立运行的 Fastify + PostgreSQL 后端基础，但浏览器端尚未接入该 API；页面中的在线人数、匹配、聊天、评论、活动申请、审核和通知仍是本地交互演示。

## 为什么是 4U

传统社交产品常从一张照片和一句简介开始。4U 尝试提供三种更具体的相遇方式：

| 发现一个人 | 参加一场活动 | 先聊一个话题 |
| --- | --- | --- |
| 从公开兴趣、生活方式和关系意图了解对方；单向心动只对自己可见。 | 围绕时间、公开区域和参与规则清楚的活动计划，体验申请同行流程。 | 先表达立场与理由，或围绕生活兴趣交流；聊得来之后再决定是否继续认识。 |

综合推荐的首批及素材充足的完整批次按人物、活动、话题 **4 : 3 : 3** 混排并随滚动加载；话题频道使用独立的持续加载逻辑。用户也可以进入单类频道或使用分组搜索继续探索。

## 产品体验

以下画面均来自当前前端代码的本地生产构建，人物、活动、授权状态与在线匹配均为合同演示数据。

<table>
  <tr>
    <td width="33%" align="center"><a href="./docs/assets/readme/person-detail-mobile.jpg"><img width="260" src="./docs/assets/readme/person-detail-mobile.jpg" alt="4U 个人详情与私密心动" /></a></td>
    <td width="33%" align="center"><a href="./docs/assets/readme/activity-detail-mobile.jpg"><img width="260" src="./docs/assets/readme/activity-detail-mobile.jpg" alt="4U 活动详情与申请同行" /></a></td>
    <td width="33%" align="center"><a href="./docs/assets/readme/topic-result-mobile.jpg"><img width="260" src="./docs/assets/readme/topic-result-mobile.jpg" alt="4U 话题投票与模拟在线讨论" /></a></td>
  </tr>
  <tr>
    <td align="center"><strong>认识一个人</strong><br />推荐理由使用模拟授权公开信息；心动不会单向通知对方。</td>
    <td align="center"><strong>了解并申请活动</strong><br />查看日程、公开区域、席位和演示中的授权参与者，并体验申请同行。</td>
    <td align="center"><strong>从话题开始</strong><br />表达选择与理由，并体验不同共识方式的模拟讨论匹配。</td>
  </tr>
</table>

### 已实现的前端旅程

- **综合推荐**：人物、活动、话题混排；支持为你、附近、本周末、新加入等筛选与持续加载。
- **寻觅与心动**：人物瀑布流、个人详情、推荐理由、一次性隐私说明和可撤回的私密心动。
- **活动参与**：展示活动收藏、成行与候补状态、模拟授权公开参与者；支持本地模拟申请，以及两步活动发起与草稿恢复。
- **话题讨论**：关系议题两阶段投票、三种模拟讨论匹配方式，以及评论、回复、点赞和模拟在线开聊。
- **消息与关系**：匹配、活动、通知三类消息入口；普通会话、活动房间和限时话题讨论房。
- **分组搜索**：按活动、用户和话题组织搜索结果，并跳转到对应详情。
- **资料与权限展示**：提供个人资料、关系意向、资产和权限分区；编辑与服务端保存尚未接入。
- **响应式体验**：移动底栏、桌面左侧导航与右侧详情轨道，覆盖 320–1440px；返回列表时保留推荐顺序、加载进度、滚动位置与焦点。
- **完整交互状态**：覆盖加载、空态、错误、离线、图片降级和弹窗键盘操作；详情 CTA 与会话输入等操作固定在视口底部。

## 产品原则

1. **先有情境，再决定关系**：共同活动和结构化话题降低直接私聊的压力。
2. **意愿必须由本人表达**：系统不代替用户心动、报名、发送消息或决定是否继续认识。
3. **隐私不是补丁**：单向心动、内部排序信号、精确地点、候选偏好和未授权参与者不进入公开投影。
4. **状态含义保持清楚**：活动灵感不等于真实组局，提交审核不等于发布，申请也不等于占座。
5. **推荐可以解释，但不能越权**：服务端资格与评分是确定性逻辑；可选 AI 只细化解释文案，并接受二次证据与安全校验。

## 技术架构

~~~mermaid
flowchart LR
  Browser[浏览器 / React SPA]
  Pages[GitHub Pages<br/>静态产品原型]
  Proxy[HTTPS / Nginx]
  API[Fastify API<br/>认证 · 校验 · 授权 · 限流]
  IdP[外部身份服务<br/>JWT Issuer]
  Keys[JWKS 密钥集<br/>HTTPS 或本地挂载]
  DB[(PostgreSQL<br/>事件 · 关系 · 推荐任务)]
  Migration[一次性数据库迁移]
  Worker[Recommendation Worker]
  Rules[进程内确定性规则模块]
  AI[OpenAI Responses API<br/>可选解释增强]

  Browser --> Pages
  Browser <--> IdP
  Browser -. Bearer token；当前 SPA 尚未接入 .-> Proxy
  Proxy --> API
  IdP -. 发布公钥 .-> Keys
  API -. 校验签名 .-> Keys
  Migration --> DB
  API --> DB
  API --> Rules
  Worker --> DB
  Worker --> Rules
  Worker -. AI_REFINEMENT_ENABLED .-> AI
~~~

图中的确定性规则是 API 与 worker 共用的进程内 TypeScript 模块，不是独立部署服务。

### 前端

- React 19、TypeScript、Vite 8、Lucide 图标。
- URL 驱动的 History / Hash 路由；GitHub Pages 构建自动使用 /4U/ 基础路径。
- 原生 CSS 响应式布局、最短列瀑布流、详情轨道、固定操作栏与键盘焦点恢复。
- 构建阶段执行定向隐私检查，确认两个私密生成模块和一组指定敏感字段未进入公开 JavaScript 产物。

### 后端基础

- Node.js 22、Fastify 5、Zod、PostgreSQL 17。
- 已实现版本化资料与 AI 同意、append-only 事件、屏蔽、私密心动、双向匹配、推荐结果与反馈。
- 支持幂等键、乐观并发控制、RS256 JWT / JWKS、精确 Origin CORS、限流和统一错误结构。
- API、迁移和 recommendation worker 分离；AI 增强默认关闭，失败或校验不通过时保留确定性规则 fallback。

更多实现细节见 [服务端架构](./docs/server-architecture.md) 和 [后端运行说明](./server/README.md)。

## 本地运行

建议使用 **Node.js 22**；后端明确要求 Node.js 22.x。

~~~bash
git clone git@github.com:happyeye1/4U.git
cd 4U
npm ci
npm run dev
~~~

打开 http://localhost:5173。

构建并预览生产静态产物：

~~~bash
npm run build:server
npm run preview -- --host 127.0.0.1
~~~

GitHub Pages 使用独立构建：

~~~bash
npm run build:pages
~~~

### 启动本地后端栈

需要 Docker Compose v2：

~~~bash
docker compose up --build -d
docker compose ps
curl --fail-with-body http://127.0.0.1:3000/ready
~~~

本地 Compose 会启动 PostgreSQL、一次性迁移、API 和 worker，使用开发认证且默认关闭 AI 增强。**它不会自动让当前前端改为调用后端。**

## 验证

前端数据与合同检查：

~~~bash
npm run test:contracts
npm run test:profiles
npm run test:activities
npm run test:recommendations
~~~

先在一个终端启动生产预览：

~~~bash
npm run build:server
npm run preview -- --host 127.0.0.1
~~~

再在另一个终端运行浏览器测试（需要本机 Chrome）：

~~~bash
npm run test:smoke
npm run test:responsive
npm run test:mobile-overlap
npm run test:create-activity
~~~

后端检查：

~~~bash
cd server
npm ci
npm run check
npm test
npm run build
~~~

## 项目结构

~~~text
4U/
├── src/                    # React 页面、领域合同与本地交互原型
├── server/                 # Fastify API、PostgreSQL 仓储、迁移与 worker
├── tests/                  # 合同、数据、交互和响应式测试
├── docs/                   # PRD、服务端架构与 README 图片
├── deploy/                 # Nginx、systemd、证书与备份参考材料
├── docker-compose.yml      # 本地完整后端栈
└── .github/workflows/      # GitHub Pages 构建与发布
~~~

## 当前边界

- GitHub Pages 只发布静态前端，不运行 Fastify、PostgreSQL 或 worker。
- 前端当前使用合成数据以及 React 内存、localStorage、sessionStorage 模拟写操作，不代表真实多人状态。
- 后端目前聚焦资料、授权、事件、关系和推荐基础；活动容量、话题、评论、真实消息传输、通知、媒体上传、内容审核和完整 onboarding 尚未形成端到端 API。
- 页面内 allowedActions、隐藏按钮、CORS 和 robots metadata 都不能替代服务端鉴权。
- README 截图中的人物与图片均用于产品演示；公开商用前需再次核对素材授权、内容来源与热链稳定性。

## 文档

- [服务端架构与安全边界](./docs/server-architecture.md)
- [后端开发、配置与部署说明](./server/README.md)
- [首次进入信息收集页 PRD](./docs/4U-%E9%A6%96%E6%AC%A1%E8%BF%9B%E5%85%A5%E4%BF%A1%E6%81%AF%E6%94%B6%E9%9B%86%E9%A1%B5-PRD-v1.0.md)

---

<div align="center">Built to help people meet through something real.</div>
