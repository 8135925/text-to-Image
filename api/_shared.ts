// 服务端共享：CORS 禁止（同源）、JSON 响应、入 IP 提取
import type { VercelRequest, VercelResponse } from '@vercel/node';

export function json(res: VercelResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // 同源部署，不开放 CORS：不设置 Access-Control-Allow-* 头
  return res.end(JSON.stringify(body));
}

export function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return String(fwd[0]);
  return req.socket?.remoteAddress ?? 'unknown';
}
