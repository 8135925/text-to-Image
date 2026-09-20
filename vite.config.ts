import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';

// ---------- 开发态 API 插件：npm run dev 直接跑通 /api/* ----------
// VercelRequest 在 dev 下用原生 Node req/res 模拟（补 body / query），
// 环境变量通过 loadEnv 从 .env.local 注入 process.env

interface ApiHandler {
  default: (
    req: IncomingMessage & { body?: unknown; query?: Record<string, string> },
    res: ServerResponse,
  ) => unknown;
}

const API_ROUTES: Record<string, string> = {
  '/api/generate': '/api/generate.ts',
  '/api/config': '/api/config.ts',
  '/api/download': '/api/download.ts',
};

function devApiPlugin(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server: ViteDevServer) {
      // .env / .env.local → process.env（仅补缺失的 key）
      const env = loadEnv(server.config.mode, server.config.root, '');
      for (const [k, v] of Object.entries(env)) {
        if (!(k in process.env)) process.env[k] = v;
      }

      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0];
        const modulePath = API_ROUTES[pathname];
        if (!modulePath) return next();

        try {
          // 模拟 Vercel 的 req.query
          const url = new URL(req.url ?? '/', 'http://localhost');
          const query: Record<string, string> = {};
          url.searchParams.forEach((v, k) => {
            query[k] = v;
          });
          (req as IncomingMessage & { query?: Record<string, string> }).query =
            query;

          // 模拟 Vercel 的 req.body（POST JSON 自动解析）
          if (req.method === 'POST') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const raw = Buffer.concat(chunks).toString('utf-8');
            let body: unknown;
            try {
              body = raw ? JSON.parse(raw) : undefined;
            } catch {
              body = undefined;
            }
            (
              req as IncomingMessage & { body?: unknown }
            ).body = body;
          }

          // ssrLoadModule 会按需编译 api/*.ts（含 ../src/prompts 依赖）
          const mod = (await server.ssrLoadModule(modulePath)) as ApiHandler;
          await mod.default(req, res);
        } catch (err) {
          console.error(`[dev-api] ${pathname} error:`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
          }
          res.end(
            JSON.stringify({
              success: false,
              code: 'E_UPSTREAM',
              message: '开发服务器内部错误，请查看终端日志',
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApiPlugin()],
  build: {
    outDir: 'dist',
  },
});
