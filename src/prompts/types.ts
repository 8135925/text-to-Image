// 共享类型与常量（前端 ⇄ 服务端契约，spec 2.4 v4：仅 mode + text，冻结）

import { XIAOHEI_STRUCTURES, HANDDRAWN_ARCHETYPES } from './constants';

const XIAOHEI_STRUCTURES_KEYS = Object.keys(XIAOHEI_STRUCTURES) as string[];
const HANDDRAWN_ARCHETYPES_KEYS = Object.keys(HANDDRAWN_ARCHETYPES) as string[];

export type Mode = 'xiaohei' | 'handdrawn';

export interface GenerateInput {
  mode: Mode;
  text: string;
}

export interface GenerateSuccess {
  success: true;
  imageUrl: string;
  model: string;
  prompt: string;
  createdAt: string;
}

export interface GenerateFailure {
  success: false;
  code: 'E_INVALID_INPUT' | 'E_NO_KEY' | 'E_RATE_LIMIT' | 'E_UPSTREAM';
  message: string;
}

export type GenerateResponse = GenerateSuccess | GenerateFailure;

export const ERROR_MESSAGES: Record<GenerateFailure['code'], string> = {
  E_INVALID_INPUT: '输入参数有误，请检查后重试',
  E_NO_KEY: '服务端尚未配置 ZHIPUAI_API_KEY，请先在 Vercel 配置',
  E_RATE_LIMIT: '请求太频繁，请稍后再试',
  E_UPSTREAM: '图像生成失败，请稍后重试',
};

export const MODE_LABELS: Record<Mode, string> = {
  xiaohei: '小黑配图',
  handdrawn: '手绘整页',
};

export const MODE_HINTS: Record<Mode, string> = {
  xiaohei: '16:9 横版 · 纯白底 · 黑色手绘线稿 · 小黑怪诞隐喻',
  handdrawn: '16:9 整页 · 暖白纸底 · 居中标题 · 淡彩手绘技术图',
};

export const TEXT_MAX_LEN = 5000;

/** 入参校验（spec 2.4 v4 契约；前后端共用） */
export function validateInput(raw: unknown):
  | { ok: true; value: GenerateInput }
  | { ok: false; message: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, message: '请求体必须是 JSON 对象' };
  }
  const body = raw as Record<string, unknown>;

  if (body.mode !== 'xiaohei' && body.mode !== 'handdrawn') {
    return { ok: false, message: 'mode 必须是 xiaohei 或 handdrawn' };
  }

  if (typeof body.text !== 'string' || !body.text.trim()) {
    return { ok: false, message: '请输入要配图的文本内容' };
  }
  const text = body.text.trim();
  const len = [...text].length;
  if (len > TEXT_MAX_LEN) {
    return { ok: false, message: `文本不能超过 ${TEXT_MAX_LEN} 字` };
  }

  return { ok: true, value: { mode: body.mode, text } };
}

// 保留导出避免误用（结构枚举仍在组装器内部使用）
export { XIAOHEI_STRUCTURES_KEYS, HANDDRAWN_ARCHETYPES_KEYS };
