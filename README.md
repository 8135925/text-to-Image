# Ian 手绘图像生成器 -

中文小黑怪诞正文配图生成 | 中文手绘技术整页图像生成

一个部署在 Vercel 的 React 网页应用：输入主题与关键信息，由内置提示词组装器（移植自 Ian 的两个手绘技能语料）自动生成完整生图提示词，经服务端代理调用智谱 CogView 图像 API，返回手绘风格图片。

- 需求文档（唯一事实来源）：`docs/design/spec/spec-ian-image-generator.md`
- 风格语料（原文 1:1 拷贝，禁止改写）：`prompts/xiaohei/`、`prompts/handdrawn/`

## 本地开发

一条命令直接跑（dev server 内置 API 路由，无需 vercel dev）：

```bash
npm install
cp .env.example .env.local   # 填入 ZHIPUAI_API_KEY
npm run dev
```

## 部署（Vercel）

1. 导入仓库，框架预设 Vite（Build `npm run build`，Output `dist`），`api/` 目录自动识别为 Serverless Functions；
2. 在 Settings → Environment Variables 配置：
   - `ZHIPUAI_API_KEY`（必填，智谱开放平台 API Key）
   - `IMAGE_MODEL`（默认 `cogview-3-flash`）
   - `ZHIPU_API_BASE`（默认 `https://open.bigmodel.cn/api/paas/v4`）
   - `DOWNLOAD_HOST_ALLOWLIST`（默认 `open.bigmodel.cn,files.bigmodel.cn`）

## 环境变量说明

见 `.env.example` 注释。所有密钥仅在服务端（API Route）读取，浏览器不直连智谱生成 API。
