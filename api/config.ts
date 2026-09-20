// GET /api/config —— 仅检查 Key 是否已配置，不发起上游调用（spec 2.2/2.4）
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json } from './_shared';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return json(res, 200, {
    model: process.env.IMAGE_MODEL || 'cogview-3-flash',
    hasKey: Boolean(process.env.ZHIPUAI_API_KEY),
    modes: ['xiaohei', 'handdrawn'],
  });
}
