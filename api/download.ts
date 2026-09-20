// GET /api/download?url=... —— 图片字节流代理下载（spec 2.2/2.4）
// 放行规则：默认白名单 ∪ 生成时动态记忆的上游域名（known-hosts）
// SSRF 防护：仅放行智谱默认域名 + 我方上游实际返回过的域名
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json } from './_shared';
import { isKnownImageHost, knownHostsSnapshot } from './known-hosts';

const DEFAULT_ALLOWLIST = [
  'sfile.chatglm.cn',
  'file.chatglm.cn',
  'open.bigmodel.cn',
  'files.bigmodel.cn',
];
const TIMEOUT_MS = 15_000;

function allowedHost(host: string): boolean {
  return DEFAULT_ALLOWLIST.includes(host) || isKnownImageHost(host);
}

interface FetchOpts {
  headers: Record<string, string>;
}

/** 拉取图片；带浏览器 UA，失败自动用简化头重试一次 */
async function fetchImage(
  url: string,
  signal: AbortSignal,
): Promise<Response> {
  const attempts: FetchOpts[] = [
    {
      headers: {
        Accept: 'image/*',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Referer: 'https://chatglm.cn/',
      },
    },
    { headers: { Accept: 'image/*' } },
  ];
  let last: Response | null = null;
  for (const opts of attempts) {
    try {
      const r = await fetch(url, { signal, headers: opts.headers, redirect: 'follow' });
      if (r.ok && r.body) return r;
      last = r;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      last = last ?? (new Response(null, { status: 502 }) as Response);
    }
  }
  return last as Response;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'GET') {
    return json(res, 405, {
      success: false,
      code: 'E_INVALID_INPUT',
      message: '仅支持 GET',
    });
  }

  const raw = typeof req.query?.url === 'string' ? req.query.url : '';
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return json(res, 400, {
      success: false,
      code: 'E_INVALID_URL',
      message: '下载链接不合法',
    });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return json(res, 400, {
      success: false,
      code: 'E_INVALID_URL',
      message: '下载链接不合法',
    });
  }

  const host = parsed.hostname.toLowerCase();
  if (!allowedHost(host)) {
    console.error(
      `[download] host rejected: ${host} (defaults: ${DEFAULT_ALLOWLIST.join(',')}, dynamic: ${knownHostsSnapshot().join(',') || 'none'})`,
    );
    return json(res, 400, {
      success: false,
      code: 'E_INVALID_URL',
      message: `下载域名 ${host} 不在白名单，请在环境变量 DOWNLOAD_HOST_ALLOWLIST 中追加`,
    });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const upstream = await fetchImage(parsed.toString(), controller.signal);
    clearTimeout(timer);

    if (!upstream.ok || !upstream.body) {
      console.error(
        `[download] upstream ${upstream.status} ${upstream.statusText} for ${parsed.toString()}`,
      );
      return json(res, 502, {
        success: false,
        code: 'E_UPSTREAM',
        message: '下载失败，图片链接可能已过期，可重新生成',
      });
    }

    res.statusCode = 200;
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'image/png',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="image.png"');
    // 不透传 Content-Length：fetch 会自动解压，长度可能对不上导致下载中断
    res.setHeader('Cache-Control', 'no-store');

    const reader = upstream.body.getReader();
    const flush = async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const ok = res.write(Buffer.from(value));
          if (!ok) await new Promise<void>((r) => res.once('drain', () => r()));
        }
        res.end();
      } catch {
        res.end();
      }
    };
    return flush();
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.error('[download] error:', isAbort ? 'timeout' : err);
    return json(res, 502, {
      success: false,
      code: 'E_UPSTREAM',
      message: isAbort ? '下载超时，请重试' : '下载失败，请重试',
    });
  }
}
