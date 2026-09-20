// 会话内历史：localStorage 最近 20 条（spec 2.3）
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
const MAX = 20;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(list) ? list.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(list: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // localStorage 满或被禁用时静默失败
  }
}

export function addHistory(
  entry: Omit<HistoryEntry, 'id'>,
): HistoryEntry[] {
  const next: HistoryEntry[] = [
    { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    ...loadHistory(),
  ].slice(0, MAX);
  saveHistory(next);
  return next;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // localStorage 被禁用时静默失败
  }
}
