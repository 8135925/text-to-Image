# Ian 手绘图像生成器 需求文档（SPEC）

> 本文档是项目开发的唯一事实来源。任何变更必须先改本文档再动代码。
>
> 修订说明（v2）：已关闭待确认项 T1/T2（技能语料已在项目内定位，模式 B 契约按语料重写）；修正模式 A 默认尺寸与「16:9」的自相矛盾；新增下载代理接口与 Vercel 函数超时配置；补齐语料资产与 License 移植清单。

## 1. 功能概述

一个部署在 Vercel 的 React 网页应用：用户输入主题与关键信息、选择生成模式，由内置的**提示词组装器**（移植自两个本地技能）自动生成完整生图提示词，经服务端代理调用智谱图像生成 API（默认 CogView-3-Flash），返回手绘风格图片，支持预览、重新生成、下载与会话内历史记录。

- **使用者**：需要为中文文章、工作流文档、PPT 制作手绘配图的内容创作者。
- **两种生成模式**（对应两个本地技能语料）：

| 模式 | 标识 | 来源技能 | 产物 | 默认尺寸 |
|------|------|---------|------|---------|
| 小黑怪诞正文配图 | `xiaohei` | ian-xiaohei-illustrations | 16:9 横版文章配图 | 1344x768（上游枚举中最接近 16:9） |
| 中文手绘技术整页图像 | `handdrawn` | ian-handdrawn-ppt | 整页手绘技术图像（封面 21:9 / 正文页 16:9） | 按页面角色：cover → 1440x720（最接近 21:9）；body → 1344x768 |

> 尺寸说明：语料要求 16:9 / 21:9，但上游模型尺寸枚举无精确对应值，按「最接近比例」映射（1344x768 = 7:4 ≈ 16:9；1440x720 = 2:1 ≈ 21:9）。此映射为有意取舍，不是错误。

- **核心原则**：API Key 与模型名全部走环境变量（Vercel 上配置），代码中不出现任何硬编码密钥；浏览器绝不直接调用智谱生成 API（注意：结果图片本身的展示是直接加载上游图片 URL，这不属于 API 调用，无密钥泄露面）。

## 2. 核心业务流程

### 2.1 数据源 / 输入

**极简输入形态（v3 修订）**：界面只有一个大段文本输入框 + 两种风格切换，无任何结构化表单字段。所有结构决策（结构类型/原型/标题/尺寸）由提示词组装器从文本语义自动推导。

| 字段 | 必填 | 约束 | 说明 |
|------|------|------|------|
| 风格 mode | ✅ | 枚举：`xiaohei` / `handdrawn` | 两种绘画风格，用户在界面上切换 |
| 文本 text | ✅ | 1–5000 字 | 大段中文文本（文章片段、想法描述均可），作为配图的全部语义来源 |

- 生成数量固定 1 张（服务端仅校验 count/size 存在时忽略或拒绝，契约不再暴露）；尺寸固定 `1344x768`（7:4 横，≈16:9），用户不可选。

**自动推导规则（组装器，spec 2.2）：**

- 模式 A：Structure type 由组装器指示图像模型「从 8 种结构类型中按文本语义选择最合适的一种」（语料 composition-patterns.md 的 8 种全部列入候选）；Core idea 取文本前 200 字
- 模式 B：pageRole 默认 `body`（16:9 比例映射 1344x768）；Title 取文本前 12 字（满足语料 Text Budget 5–12 字；不足 5 字时重复补足或由模型从文本提炼短标题）；Archetype 按文本语义从 12 种原型中选择；Required text only 含标题与模型从文本提炼的少量关键中文标签（≤5 个）
- 上游提示词长度上限 1000 字：文本超长时截断（保留开头），截断逻辑在组装器内实现

**尺寸/比例（固定，用户不可选）**：`1344x768`（7:4 横，≈16:9）。上游支持集（CogView-3-Flash）仍为 1024x1024、768x1344、864x1152、1344x768、1152x864、1440x720、720x1440，如需调整改 `api/generate.ts` 常量。

### 2.2 处理逻辑

**整体链路**：React 表单 → `POST /api/generate`（Vercel Serverless Function）→ 组装提示词 → 调用智谱图像 API → 返回图片 URL → 前端展示。

**提示词组装器（本项目核心资产）：**

1. 项目仓库内建立 `prompts/` 目录，将两个技能语料 **原文 1:1 拷贝**入库（作为语料与文档，禁止改写），源为**项目内**副本（不再依赖本机用户目录）：
   - `prompts/xiaohei/` ← 源 `.codebuddy/skills/ian-xiaohei-illustrations-main/ian-xiaohei-illustrations/`（SKILL.md + references/*.md；`assets/examples/` 仅作风格校准、不进生成路径，**不拷贝**）
   - `prompts/handdrawn/` ← 源 `.codebuddy/skills/ian-handdrawn-ppt-main/ian-handdrawn-ppt/`（SKILL.md + references/*.md + **`assets/theme-tokens.json`**——本项目不支持参考图输入，语料规定此时以 theme tokens 提示词匹配风格，必须拷入；风格锚点 PNG 无用武之地，不拷贝）
   - 两个语料各自目录中的 `LICENSE`、`NOTICE.md` 一并拷入对应子目录，满足再分发合规要求
2. `src/prompts/` 下将语料转化为代码常量与组装函数：
   - **模式 A**（源自 xiaohei 语料的 `references/style-dna.md`、`xiaohei-ip.md`、`composition-patterns.md`、`prompt-template.md`）：
     - `STYLE_DNA`：视觉基因（纯白背景、黑色手绘线稿、大量留白、少量红/橙/蓝中文手写批注、禁忌清单——禁止 PPT 风/商业插画/可爱卡通/渐变阴影/左上角标题等）
     - `XIAOHEI_IP`：小黑形象（黑色实心、白点眼、细腿、空表情、认真做荒诞的事；必须是画面核心动作主体，不是装饰）
     - `STRUCTURES`：8 种结构类型枚举及各自的构图指引（含小黑动作池、物件池）
     - `PROMPT_TEMPLATE`：单张生图提示词模板（Theme / Structure type / Core idea / Composition / Suggested elements / Chinese labels / Color use / Constraints 八段式）
     - `buildPrompt(mode, inputs): string`：按所选模式把上述常量与用户输入拼装为完整提示词
   - **模式 B**（源自 handdrawn 语料的 `references/visual-dna-v6.md`、`slide-archetypes.md`、`prompt-patterns.md`）：
     - `STYLE_DNA_B`：deck style lock（暖白纸底 ≈#FBFAF5、无整页边框、左上角小页码、居中中文标题+淡蓝下划线、细钢笔线+排线、淡彩标签、大量留白、禁忌清单）
     - `ARCHETYPES_B`：12 种原型枚举及各自构图结构
     - `PAGE_ROLE_LOCKS_B`：cover / body 两种页面角色锁（画幅、标题规格、中央图占比 50–60% 宽 / 35–45% 高）
     - `PROMPT_TEMPLATE_B`：整页提示词模板（Page role / Title / Subtitle / Archetype / Main point / Style lock / Composition / Scale lock / Required text only / Avoid 十段式）
3. **自动推导规则**（v3：无结构化表单，全部由组装器从文本语义推导）：
   - 模式 A：Structure type 段写为「按文本语义从 8 种结构类型（Workflow / 系统局部 / 前后对比 / 角色状态 / 概念隐喻 / 方法分层 / 地图路线 / 小漫画分镜）中选择最合适的一种」；Core idea 取文本前 200 字；Composition / Suggested elements / Chinese labels 均指示图像模型按文本语义现场发明（语料禁止复刻旧构图）
   - 模式 B：pageRole 固定 `body`；Title 取文本前 12 字（语料 Text Budget 5–12 字）；Archetype 段写为「按文本语义从 12 种原型中选择最合适的一种」；Required text only 含标题 + 指示模型从文本提炼 ≤5 个关键中文短标签，并保留语料 Avoid 清单禁止额外文字

**服务端代理（API Route，Node.js runtime）：**

1. 校验入参（见 2.4 契约，按 mode 分别校验），非法直接返回 E_INVALID_INPUT；
2. `buildPrompt()` 组装提示词；
3. 调用 `POST {ZHIPU_API_BASE}/images/generations`，请求体 `{ model, prompt, size }`，请求头 `Authorization: Bearer {ZHIPUAI_API_KEY}`；
4. 上游返回 `data[0].url`（图片 URL），透传给前端；同时返回本次组装的完整 `prompt`（供「复制提示词」功能）；
5. 简单内存频控：每 IP 60 秒内最多 5 次，超出返回 E_RATE_LIMIT（serverless 实例重置导致频控归零可接受，不引入外部存储）；
6. **函数超时**：`api/generate.ts` 中显式导出 `export const maxDuration = 30`（Vercel Hobby 计划函数上限 60s，30s 可用；不配置此项则默认 10s，超时形同虚设）。

**视频生成（`api/generate-video.ts`，模型写死 `cogvideox-flash` 免费）**：CogVideoX 为异步任务接口，链路分两步：
1. `POST /api/generate-video`（入参与图像一致：mode + text）→ 组装视频提示词（用户文本前 420 字 + 手绘风格后缀，≤512 字符）→ 提交上游 `POST {ZHIPU_API_BASE}/videos/generations`（quality=speed、size=1920x1080、fps=30、duration=5）→ 返回 `{ success, taskId, prompt, model }`；
2. `GET /api/generate-video?taskId=` → 代理上游 `GET {ZHIPU_API_BASE}/async-result/{id}` → 返回 `{ status: PROCESSING | SUCCESS | FAIL, videoUrl?, coverUrl? }`；前端每 3 秒轮询，最长 5 分钟（100 次），FAIL/超时显示错误与重试按钮；成功后右栏以 `<video controls>` 播放（含封面 poster），不写入历史记录；生成中按钮禁用防重复提交；与图像共用每 IP 频控。

**连通性/配置验证方式**：应用启动时不预检上游；`GET /api/config` 仅检查 `ZHIPUAI_API_KEY` 是否已配置（不发起上游调用），前端据此显示配置引导。

### 2.3 输出 / 产物管理

- 单次固定生成 1 张，在结果区大图展示；**历史记录只记录生成的图片**（视频生成不写历史）；历史图片点击放大后的灯箱支持**左右箭头浏览**（‹ 上一张 / › 下一张，键盘 ←/→ 同效，显示位置「N / 总数」）；
- 结果区操作：**重新生成**（同参数再调一次，AI 生成结果天然有随机性）、**复制提示词**；
- 会话内历史：`localStorage` 保存最多 30 条（模式、文本、提示词、图片 URL、时间），刷新不丢；页面提供历史卡片列表，点击可回看提示词；达到 30 条上限时新记录顶掉最早一条并显示「已达上限，可全部删除清理」提示；
- 历史导出/导入：localStorage 按域名隔离，本地记录不会出现在线上域名；提供「导出」（下载 JSON）与「导入」（选择 JSON、校验去重合并）功能用于跨域名迁移历史；
- 冷启动种子：`scripts/fetch-history.mjs`（`npm run fetch-history`）把导出的历史 JSON 中图片下载到 `public/history-images/` 并生成 `public/seed-history.json`（imageUrl 本地化，永不过期）；localStorage 为空时自动加载种子，实现内置历史记录；
- 单条删除：历史卡片提供「删除」按钮，仅删该条；
- 上游图片 URL 有效期不保证长期有效，历史条目加载失败时显示占位提示「图片链接已过期，可重新生成」；
- 无服务端持久化、无用户系统、无跨设备同步（轻量原则，明确不做）。

### 2.4 接口契约（前端 ⇄ 服务端，冻结）

**POST /api/generate**

- 入参（v4 契约：只有两个必填字段）：

```json
{
  "mode": "xiaohei | handdrawn",
  "text": "string, 1-5000 字, 必填（大段中文文本，配图的全部语义来源）"
}
```

- 出参（成功）：

```json
{
  "success": true,
  "imageUrls": ["https://...", "..."],
  "model": "cogview-3-flash",
  "prompt": "组装后的完整提示词",
  "createdAt": "ISO 8601"
}
```

- 出参（失败）：`{ "success": false, "code": "错误码", "message": "人类可读中文信息" }`

- 错误码：

| code | HTTP | 场景 |
|------|------|------|
| E_INVALID_INPUT | 400 | 参数缺失 / 超长 / 枚举外取值 / 模式专属字段违规 |
| E_NO_KEY | 503 | 服务端未配置 ZHIPUAI_API_KEY |
| E_RATE_LIMIT | 429 | 触发每 IP 频控 |
| E_UPSTREAM | 502 | 上游生成失败 / 超时 / 内容审核未通过 |
- 若上游 URL 的实际域名不在默认 allowlist，在 Vercel 环境变量中追加即可，无需改代码。

**GET /api/config**（首页加载时调用）

- 出参：`{ "model": "cogview-3-flash", "hasKey": true, "modes": ["xiaohei", "handdrawn"] }`
- 用途：顶部显示当前模型名；`hasKey=false` 时显示「请在 Vercel 配置 ZHIPUAI_API_KEY」引导卡片，表单禁用。

## 3. 配置项清单

| key | 含义 | 默认值 | 配置位置 |
|-----|------|--------|---------|
| ZHIPUAI_API_KEY | 智谱开放平台 API Key | 无（必填） | Vercel → Settings → Environment Variables；本地 `.env.local` |
| IMAGE_MODEL | 图像生成模型 ID | `cogview-3-flash` | 同上 |
| ZHIPU_API_BASE | 智谱 API 基地址 | `https://open.bigmodel.cn/api/paas/v4` | 同上（可切换国际端点） |

- `.env.example`（仅含上述三个 key 的空模板与注释）提交入库；`.env.local`、`.env` 一律进 `.gitignore`；
- 三个 key 均只在服务端（API Route）读取；前端如需展示模型名，通过 `GET /api/config` 获取，**禁止**在 Vite 侧使用 `VITE_` 前缀暴露任何密钥类变量；
- 注意：`IMAGE_MODEL` 切换（如 `cogview-4`）时，2.1 节的尺寸枚举是按 CogView-3-Flash 写的，换模型需**同步核对上游 size 支持集**并更新本文档（见验收标准 7 的限定语）。

## 4. 非功能需求

**技术栈（锁定）：**

- React 18 + TypeScript + Vite；
- 服务端：Vercel Serverless Functions（`api/` 目录，Node.js runtime），不用 Express/Nest 等框架；
- 不引入重型 UI 组件库（不使用 antd / MUI）；样式手写 CSS（CSS Modules 或原生 CSS 变量方案）；
- HTTP 客户端：原生 `fetch`；
- 依赖白名单：`react`、`react-dom`、`typescript`、`vite`、`@vitejs/plugin-react`、`@vercel/node`（类型）——白名单之外引入需人工确认。

**前端设计规范（严格按 `DESIGN-apple.md` 执行，该文件拷贝入项目 `docs/` 下）：**

- 唯一交互色 Action Blue `#0066cc`（暗色区用 `#2997ff`），禁止第二强调色；
- 字体栈 `SF Pro Display/Text, system-ui, -apple-system`（非苹果平台回退 Inter，display 尺寸 letter-spacing 收紧 `-0.01em`，body 行高 1.47→1.44）；
- 正文 17px / 400；标题 600 + 负字距；字重阶梯只有 300/400/600/700；
- 主按钮为 Action Blue 胶囊（pill），按压态统一 `transform: scale(0.95)`；
- 页面节奏（v3 三栏工作台布局）：黑色全局导航条（44px，含模型名）→ 白色 Hero（display 级标题，短）→ **三栏工作台**：左栏文本输入卡片（白底、18px 圆角、1px hairline 边框、24px 内边距，大段文本 textarea 占满）｜中栏控制列（风格切换 pill chips + Action Blue 胶囊「开始生成」按钮，垂直居中）｜右栏结果区（Parchment `#f5f5f7` 底，图片带系统唯一投影 `rgba(0,0,0,0.22) 3px 5px 30px`，附重新生成/下载/复制提示词操作）→ 历史卡片网格（白底 utility card）→ Parchment 页脚；
- 模式选择器用 pill 形 chips（参考 configurator-option-chip：选中态 2px `#0071e3` 描边）；
- 未配置 Key 时：三栏仍渲染，但生成按钮禁用并在按钮旁显示一行中文提示「请在 Vercel 配置 ZHIPUAI_API_KEY 后使用」（不弹大卡片）；
- 禁止：卡片/按钮/文字投影、装饰渐变、全出血区块加圆角、body 字重 500。

**安全：**

- ZHIPUAI_API_KEY 只存在于服务端环境变量；构建产物（dist）中不得出现 key（验收时 grep 验证）；
- 同源部署，API Route 不开放 CORS；
- 下载代理强制主机白名单，杜绝 SSRF（url 只允许 http/https 且主机可解析）；（v5：下载功能已整体移除，此条不再适用）
- 所有用户输入做长度与类型校验后再进入提示词（防提示词注入不做深度防御，仅截断长度——轻量原则）。

**性能与可用性：**

- 单次生成预期 2–5 秒，API Route 超时 30s（`maxDuration` 显式配置，见 2.2）；生成中按钮置 loading 态并禁用重复提交；
- 响应式：375px–1440px+ 可用（断点参考 DESIGN-apple.md：1440 内容锁宽 / 834 / 640 / 480）；
- 界面语言：简体中文。

## 5. 验收标准

1. 首页 3 秒内完成渲染；未配置 Key 时生成按钮禁用并显示中文提示，不白屏、不报错；
2. 模式 A：粘贴一段文本 → 点「开始生成」→ 10 秒内返回图片，且图片为纯白底、黑色手绘线稿、含小黑角色与中文标注；
3. 「复制提示词」得到的文本包含 STYLE_DNA 关键要素（纯白背景 / 手绘线稿）与小黑 IP 描述（黑色实心、白点眼）；
4. 连续点击「重新生成」3 次，均正常返回且结果区更新，无重复提交导致的并发错乱；
5. （v5：下载功能已移除，原「下载得到可打开 PNG」验收项废止；如需保存图片，用户可右键图片另存为）；
6. 浏览器 DevTools Network 面板中，API 类请求只见 `/api/generate`、`/api/config`——除结果图片本身的 `<img>` 加载外，无任何携带密钥或直连生成接口的请求；`dist` 构建产物 grep 不到 API Key；
7. 在 Vercel 将 `IMAGE_MODEL` 改为 `cogview-4` 并重新部署后，页面显示的模型名随之变化，代码零改动（前提：已按第 3 节核对 cogview-4 的 size 支持集并按需更新尺寸枚举）；
8. 同一 IP 60 秒内第 6 次请求返回 429 与中文提示「请求太频繁，请稍后再试」；
9. 拔网线 / 上游返回错误时，界面显示可读错误信息并提供「重试」按钮，不崩溃；
10. 375px 宽度下：文本输入、风格切换、生成按钮、结果图、历史列表均可正常操作（三栏纵排）；
11. 模式 B：切换到「手绘整页」风格后，同一文本生成链路与模式 A 一致，尺寸默认 1344x768；复制提示词得到的文本包含 deck style lock（暖白纸底、无整页边框）、Title（取自文本前 12 字）与 Required text only 清单。

## 6. 部署与目录约定

- 部署目标：Vercel（框架预设 Vite，Build `npm run build`，Output `dist`；API Route 自动识别 `api/` 目录）；
- 函数超时：`api/generate.ts` 导出 `maxDuration = 30`；
- 推荐项目目录（语料与文档统一放 `docs/`，与仓库现状一致）：

```
Text-to-Image/
├── api/
│   ├── generate.ts        # POST /api/generate（maxDuration = 30）
│   └── config.ts          # GET /api/config
├── src/
│   ├── prompts/           # 提示词常量与 buildPrompt()
│   ├── components/        # 表单 / 结果区 / 历史卡片 / 导航 / 页脚
│   ├── App.tsx
│   └── main.tsx
├── prompts/               # 两个技能的原文语料（1:1 拷贝，含 LICENSE/NOTICE）
│   ├── xiaohei/           # SKILL.md + references/（不含 assets/examples/）
│   └── handdrawn/         # SKILL.md + references/ + assets/theme-tokens.json + LICENSE/NOTICE
├── docs/
│   ├── design/spec/spec-ian-image-generator.md   # 本文档
│   └── DESIGN-apple.md                            # 前端设计规范
├── .env.example
└── package.json
```

## 7. 技能资产移植清单

| 源（项目内语料副本） | 目标（项目内） | 移植方式 |
|---|---|---|
| `.codebuddy/skills/ian-xiaohei-illustrations-main/ian-xiaohei-illustrations/` 的 `SKILL.md` + `references/*.md` + `LICENSE`/`NOTICE.md` | `prompts/xiaohei/` | 原文 1:1 拷贝；转化为 `src/prompts/` 常量（STYLE_DNA / XIAOHEI_IP / STRUCTURES / PROMPT_TEMPLATE / buildPrompt）；`assets/examples/` 不拷贝 |
| `.codebuddy/skills/ian-handdrawn-ppt-main/ian-handdrawn-ppt/` 的 `SKILL.md` + `references/*.md` + `assets/theme-tokens.json` + `LICENSE`/`NOTICE.md` | `prompts/handdrawn/` | 原文 1:1 拷贝；产出模式 B 常量集（STYLE_DNA_B / ARCHETYPES_B / PAGE_ROLE_LOCKS_B / PROMPT_TEMPLATE_B）；风格锚点 PNG 不拷贝（API 不支持参考图） |

> 移植原则：语料原文不改写；代码常量是语料的**忠实压缩**，禁止自行发挥风格定义（纸色、留白、文字预算、禁忌清单等以语料为准）。

## 8. 决策与待确认清单

**已关闭：**

| # | 事项 | 结论 |
|---|------|------|
| T1 | ian-handdrawn-ppt 技能路径 | 已定位：`.codebuddy/skills/ian-handdrawn-ppt-main/ian-handdrawn-ppt/`（项目内副本，语料明确 cover 21:9 / body 16:9，模式 B 契约已按语料写入 2.1/2.4/7 节） |
| T2 | 模式 B 默认尺寸 | 按语料：cover（21:9）→ 上游 1440x720；body（16:9）→ 上游 1344x768 |
| T3 | 图片是否服务端转存 | 不转存；透传 URL + 过期占位提示 |
| T4 | 频控方案 | 内存频控（每 IP 60s / 5 次），接受 serverless 重置 |

**仍开放：**

| # | 事项 | 影响 | 当前假设 |
|---|------|------|---------|
| T5 | 上游返回图片 URL 的实际域名与有效期 | 历史过期提示文案（下载代理已随 v5 移除） | 已验证为 `sfile.chatglm.cn`，历史图过期占位提示已实现 |
| T6 | CogView-3-Flash 对长中文提示词（模式 B 模板含完整 style lock，约 400–600 字）的遵循度 | 模式 B 出图质量 | 开发期用 2–3 个 archetype 冒烟验证；若遵循度差，压缩 style lock 为语料允许的 compact 版本 |
