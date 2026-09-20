// 视频生成（异步任务）：POST 提交任务 / GET ?taskId= 轮询结果
// 模型写死 cogvideox-flash（免费），风格沿用项目手绘语言（spec 2.2）
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, clientIp } from './_shared';
import { checkRateLimit } from './rate-limit';
import { validateInput, buildVideoPrompt, ERROR_MESSAGES } from '../src/prompts';

export const maxDuration = 30;

const DEFAULT_API_BASE = 'https://open.bigmodel.cn/api/paas/v4';
const MODEL = 'cogvideox-flash'; // 写死（需求指定）
const TIMEOUT_MS = 25_000;

interface UpstreamTask {
  id?: string;
  task_status?: string;
  video_result?: { url?: string; cover_image_url?: string }[];
}

/** GET /api/generate-video?taskId=xxx —— 查询任务状态 */
async function handleQuery(req: VercelRequest, res: VercelResponse) {
  const taskId = typeof req.query?.taskId === 'string' ? req.query.taskId : '';
  if (!taskId || !/^[A-Za-z0-9_-]{1,128}$/.test(taskId)) {
    return json(res, 400, {
      success: false,
      code: 'E_INVALID_INPUT',
      message: 'taskId 不合法',
    });
  }

  const apiKey = process.env.ZHIPUAI_API_KEY;
  if (!apiKey) {
    return json(res, 503, {
      success: false,
      code: 'E_NO_KEY',
      message: ERROR_MESSAGES.E_NO_KEY,
    });
  }

  const apiBase = process.env.ZHIPU_API_BASE || DEFAULT_API_BASE;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const upstream = await fetch(`${apiBase}/async-result/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      console.error(`[generate-video] query upstream ${upstream.status}`);
      return json(res, 502, {
        success: false,
        code: 'E_UPSTREAM',
        message: ERROR_MESSAGES.E_UPSTREAM,
      });
    }

    const data = (await upstream.json()) as UpstreamTask;
    const status = data.task_status ?? 'PROCESSING';

    if (status === 'FAIL') {
      return json(res, 200, { success: true, status: 'FAIL' });
    }

    if (status === 'SUCCESS') {
      const videoUrl = data.video_result?.[0]?.url;
      if (!videoUrl) {
        return json(res, 502, {
          success: false,
          code: 'E_UPSTREAM',
          message: ERROR_MESSAGES.E_UPSTREAM,
        });
      }
      return json(res, 200, {
        success: true,
        status: 'SUCCESS',
        videoUrl,
        coverUrl: data.video_result?.[0]?.cover_image_url ?? undefined,
      });
    }

    // PROCESSING / 其他中间态
    return json(res, 200, { success: true, status: 'PROCESSING' });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.error('[generate-video] query error:', isAbort ? 'timeout' : err);
    return json(res, 502, {
      success: false,
      code: 'E_UPSTREAM',
      message: isAbort ? '查询超时，请重试' : ERROR_MESSAGES.E_UPSTREAM,
    });
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method === 'GET') return handleQuery(req, res);
  if (req.method !== 'POST') {
    return json(res, 405, {
      success: false,
      code: 'E_INVALID_INPUT',
      message: '仅支持 POST / GET',
    });
  }

  // 频控（与图像共用）
  if (!checkRateLimit(clientIp(req))) {
    return json(res, 429, {
      success: false,
      code: 'E_RATE_LIMIT',
      message: ERROR_MESSAGES.E_RATE_LIMIT,
    });
  }

  // 入参校验（与图像一致：mode + text）
  const parsed = validateInput(req.body);
  if (!parsed.ok) {
    return json(res, 400, {
      success: false,
      code: 'E_INVALID_INPUT',
      message: parsed.message,
    });
  }
  const input = parsed.value;

  const apiKey = process.env.ZHIPUAI_API_KEY;
  if (!apiKey) {
    return json(res, 503, {
      success: false,
      code: 'E_NO_KEY',
      message: ERROR_MESSAGES.E_NO_KEY,
    });
  }

  // 组装视频提示词并提交任务
  const prompt = buildVideoPrompt(input);
  const apiBase = process.env.ZHIPU_API_BASE || DEFAULT_API_BASE;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const upstream = await fetch(`${apiBase}/videos/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        quality: 'speed',
        size: '1920x1080',
        fps: 30,
        duration: 5,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      console.error(`[generate-video] submit upstream ${upstream.status}`);
      return json(res, 502, {
        success: false,
        code: 'E_UPSTREAM',
        message: ERROR_MESSAGES.E_UPSTREAM,
      });
    }

    const data = (await upstream.json()) as UpstreamTask;
    if (!data.id) {
      return json(res, 502, {
        success: false,
        code: 'E_UPSTREAM',
        message: ERROR_MESSAGES.E_UPSTREAM,
      });
    }

    return json(res, 200, {
      success: true,
      taskId: data.id,
      prompt,
      model: MODEL,
    });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.error('[generate-video] submit error:', isAbort ? 'timeout' : err);
    return json(res, 502, {
      success: false,
      code: 'E_UPSTREAM',
      message: isAbort ? '提交超时，请重试' : ERROR_MESSAGES.E_UPSTREAM,
    });
  }
}
