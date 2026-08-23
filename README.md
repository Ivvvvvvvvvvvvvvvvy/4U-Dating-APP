# for U 响应式社交发现 MVP

for U 是依据《4U 综合社交发现网站技术设计 RFC v1.0》与 UI 设计规范实现的前端合同原型。旧仓库业务页面已整体替换，当前实现以 RFC 的领域状态、统一 FeedCard、隐私边界、URL 路由和响应式约束为准。

## 本地运行

    npm install
    npm run dev

生产构建与验收：

    npm run build
    npm run test:contracts
    npm run test:profiles
    npm run test:smoke
    npm run test:responsive

服务器静态产物使用 `npm run build:server`，输出到 `dist/client`；GitHub Pages 使用独立的 `npm run build:pages`，输出到 `dist/pages`。两条构建链路都会在干净目录中执行客户端隐私扫描。

浏览器测试依赖本机 Chrome，并假设预览服务运行在 http://127.0.0.1:4173：

    npm run preview -- --host 127.0.0.1

## 已实现

- RFC 统一 FeedCard envelope，支持 PERSON / ACTIVITY / ACTIVITY_OPPORTUNITY / TOPIC。
- URL 驱动的首页频道、寻觅、消息、我的、三类详情、会话、搜索和发起活动流程。
- 确定性最短列瀑布流：320–430px 2 列、768px 3 列、1024/1280px 4 列、1440px 5 列。
- 移动底栏、桌面左栏、桌面右侧详情分栏，以及返回后的 URL、滚动与焦点恢复。
- 活动三维状态、报名状态语义、活动收藏与个人心动完全分离。
- 单向心动一次性隐私说明；公开数据不含精确地点、内部匹配分、入站单向心动和未授权参与者。
- 200 份确定性生成的成年虚构人物档案，覆盖 4 类性别、5 类关系目标、17 种 MBTI 状态、12 星座与 16 个行业。
- 每份档案包含 5–8 个兴趣、3 个近期重点、生活方式五轴、关系八维证据、活动预算/消费/费用分担偏好与 2–6 张抽象 SVG 插画。
- 完整生日和候选偏好只存在于测试生成器；客户端仅导入公开静态投影，生产构建会自动检查私密模块与字段未进入浏览器包。
- 消息传输状态、服务端序号和显式发送的前端合同演示。
- 加载、空态、错误、离线、图片失败、Toast、Modal 与键盘导航。

## 能力边界

这是前端合同演示，不连接真实 API、数据库、推荐服务、AI、实时网关、审核或通知系统。页面上的写操作仅在当前浏览器模拟，用于验证状态和交互合同；不能证明服务端幂等、容量原子性、权限强校验、屏蔽隔离或生产发布门禁已经实现。

接入后端时应保持 src/domain.ts 的公开 DTO 边界，并将 allowedActions 继续视为 UI hint；所有写操作仍需服务端重新鉴权和校验最新版本。

合成人物字段或生成规则有变化时，先重新生成公开数据并验证：

    npm run generate:profiles-public
    npm run test:profiles
    npm run build

## GitHub Pages

推送到 main 后，GitHub Actions 会自动构建并发布到：

    https://happyeye1.github.io/4U/

Pages 构建自动使用 /4U/ 静态资源前缀和 Hash 路由；本地开发仍使用普通路径路由。
