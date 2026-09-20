// 会话内历史：localStorage 保存（spec 2.3）
// 上限 30 条：超限时移除最早记录并通过 overflow 标记提示用户删除
// 支持导出/导入 JSON：用于跨域名迁移（如 localhost → Vercel 线上）
import type { Mode } from '../prompts';

export interface HistoryEntry {
  id: string;
  mode: Mode;
  text: string;
  prompt: string;
  imageUrl: string;
  createdAt: string;
}

const KEY = 'ian-image-history';
export const HISTORY_MAX = 30;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(list) ? list.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(list: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
  } catch {
    // localStorage 满或被禁用时静默失败
  }
}

export interface AddHistoryResult {
  list: HistoryEntry[];
  /** 本次新增时历史已达上限（最早记录被移除），应提示用户删除 */
  overflow: boolean;
}

export function addHistory(
  entry: Omit<HistoryEntry, 'id'>,
): AddHistoryResult {
  const prev = loadHistory();
  const next: HistoryEntry[] = [
    { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    ...prev,
  ].slice(0, HISTORY_MAX);
  saveHistory(next);
  return { list: next, overflow: prev.length >= HISTORY_MAX };
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // localStorage 被禁用时静默失败
  }
}

/** 删除单条历史记录 */
export function deleteEntry(id: string): HistoryEntry[] {
  const next = loadHistory().filter((e) => e.id !== id);
  saveHistory(next);
  return next;
}

/**
 * 冷启动种子：localStorage 为空时从 public/seed-history.json 加载内置历史
 * （由 scripts/fetch-history.mjs 生成，图片本地化在 public/history-images/，永不过期）
 */
export async function ensureSeeded(): Promise<HistoryEntry[]> {
  const stored = loadHistory();
  if (stored.length > 0) return stored;
  try {
    const res = await fetch('/seed-history.json');
    if (!res.ok) return [];
    const seed = (await res.json()) as unknown;
    if (!Array.isArray(seed) || seed.length === 0) return [];
    const valid = seed.filter(
      (e): e is HistoryEntry =>
        typeof e === 'object' &&
        e !== null &&
        ((e as HistoryEntry).mode === 'xiaohei' ||
          (e as HistoryEntry).mode === 'handdrawn') &&
        typeof (e as HistoryEntry).text === 'string' &&
        typeof (e as HistoryEntry).imageUrl === 'string',
    );
    if (valid.length === 0) return [];
    saveHistory(valid);
    return loadHistory();
  } catch {
    return [];
  }
}

/** 导出全部历史为 JSON 字符串（用于跨站点迁移） */
export function exportHistoryJson(): string {
  return JSON.stringify(loadHistory(), null, 2);
}

/** 导入历史 JSON：校验合法条目、按 id 去重、合并后截断到上限。失败返回 null */
export function importHistoryJson(raw: string): HistoryEntry[] | null {
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return null;
    const valid = list.filter(
      (e): e is HistoryEntry =>
        typeof e === 'object' &&
        e !== null &&
        (e as HistoryEntry).mode !== 'xiaohei' &&
        (e as HistoryEntry).mode !== 'handdrawn' &&
        typeof (e as HistoryEntry).text === 'string' &&
        typeof (e as HistoryEntry).prompt === 'string' &&
        typeof (e as HistoryEntry).imageUrl === 'string' &&
        typeof (e as HistoryEntry).createdAt === 'string' &&
        typeof (e as HistoryEntry).id === 'string',
    );
    if (valid.length === 0) return null;
    // 合并去重：导入的在前（视为较新），同 id 保留一个
    const seen = new Set<string>();
    const merged: HistoryEntry[] = [];
    for (const e of [...valid, ...loadHistory()]) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      merged.push(e);
    }
    const next = merged.slice(0, HISTORY_MAX);
    saveHistory(next);
    return next;
  } catch {
    return null;
  }
}
