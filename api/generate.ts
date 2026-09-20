// POST /api/generate —— 组装提示词并代理调用智谱图像 API（spec 2.2/2.4 v4）
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, clientIp } from './_shared';
import { checkRateLimit } from './rate-limit';
import {
  validateInput,
  buildPrompt,
  ERROR_MESSAGES,
} from '../src/prompts';

export const maxDuration = 30;

const DEFAULT_API_BASE = 'https://open.bigmodel.cn/api/paas/v4';
const DEFAULT_MODEL = 'cogview-3-flash';
const FIXED_SIZE = '1344x768'; // 固定 16:9 映射，用户不可选（spec 2.1）
const TIMEOUT_MS = 28_000; // 留 2s 余量给函数自身的 maxDuration=30s

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return json(res, 405, {
      success: false,
      code: 'E_INVALID_INPUT',
      message: '仅支持 POST',
    });
  }

  // 1. 频控
  if (!checkRateLimit(clientIp(req))) {
    return json(res, 429, {
      success: false,
      code: 'E_RATE_LIMIT',
      message: ERROR_MESSAGES.E_RATE_LIMIT,
    });
  }

  // 2. 入参校验（v4：mode + text）
  const parsed = validateInput(req.body);
  if (!parsed.ok) {
    return json(res, 400, {
      success: false,
      code: 'E_INVALID_INPUT',
      message: parsed.message,
    });
  }
  const input = parsed.value;

  // 3. Key 检查
  const apiKey = process.env.ZHIPUAI_API_KEY;
  if (!apiKey) {
    return json(res, 503, {
      success: false,
      code: 'E_NO_KEY',
      message: ERROR_MESSAGES.E_NO_KEY,
    });
  }

  // 4. 组装提示词与尺寸（固定 1344x768）
  const prompt = buildPrompt(input);
  const apiBase = process.env.ZHIPU_API_BASE || DEFAULT_API_BASE;
  const model = process.env.IMAGE_MODEL || DEFAULT_MODEL;

  // 5. 调用上游
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const upstream = await fetch(`${apiBase}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, prompt, size: FIXED_SIZE }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      console.error(`[generate] upstream ${upstream.status}`);
      return json(res, 502, {
        success: false,
        code: 'E_UPSTREAM',
        message: ERROR_MESSAGES.E_UPSTREAM,
      });
    }

    const data = (await upstream.json()) as {
      data?: { url?: string }[];
    };
    const imageUrl = data?.data?.[0]?.url;
    if (!imageUrl) {
      return json(res, 502, {
        success: false,
        code: 'E_UPSTREAM',
        message: ERROR_MESSAGES.E_UPSTREAM,
      });
    }

    // 6. 返回（含组装后的完整提示词，供「复制提示词」）
    return json(res, 200, {
      success: true,
      imageUrl,
      model,
      prompt,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.error('[generate] error:', isAbort ? 'timeout' : err);
    return json(res, 502, {
      success: false,
      code: 'E_UPSTREAM',
      message: isAbort
        ? '生成超时，请稍后重试'
        : ERROR_MESSAGES.E_UPSTREAM,
    });
  }
}
