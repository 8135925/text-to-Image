// 历史卡片网格：上限 30 条，超限提示；支持导出/导入 JSON、点击放大（spec 2.3）
import { useRef, useState } from 'react';
import type { HistoryEntry } from '../lib/history';
import {
  HISTORY_MAX,
  exportHistoryJson,
  importHistoryJson,
} from '../lib/history';
import { MODE_LABELS } from '../prompts';
import ImageLightbox from './ImageLightbox';

interface Props {
  history: HistoryEntry[];
  onRegenerate: (entry: HistoryEntry) => void;
  onClearAll: () => void;
  onImport: (list: HistoryEntry[]) => void;
  /** 删除单条记录 */
  onDelete: (id: string) => void;
  /** 超限提示（本次生成时已达上限） */
  overflowNotice: boolean;
  onDismissOverflow: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function HistoryGrid({
  history,
  onRegenerate,
  onClearAll,
  onImport,
  onDelete,
  overflowNotice,
  onDismissOverflow,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (history.length === 0) {
    return null;
  }

  const handleClear = () => {
    if (window.confirm(`确定删除全部 ${history.length} 条历史记录吗？此操作不可恢复。`)) {
      onClearAll();
      setExpandedId(null);
      onDismissOverflow();
    }
  };

  const handleExport = () => {
    const blob = new Blob([exportHistoryJson()], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ian-image-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    const raw = await file.text();
    const merged = importHistoryJson(raw);
    if (merged) {
      onImport(merged);
      setImportMsg(`已导入，当前共 ${merged.length} 条记录`);
    } else {
      setImportMsg('导入失败：文件不是有效的历史记录 JSON');
    }
    setTimeout(() => setImportMsg(null), 4000);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <section className="history">
      <div className="history-header">
        <h2 className="history-title">
          历史记录
          <span className="history-count">{history.length} / {HISTORY_MAX}</span>
        </h2>
        <div className="history-tools">
          <button
            type="button"
            className="btn-clear-history"
            onClick={handleExport}
          >
            导出
          </button>
          <button
            type="button"
            className="btn-clear-history"
            onClick={() => fileInputRef.current?.click()}
          >
            导入
          </button>
          <button
            type="button"
            className="btn-clear-history"
            onClick={handleClear}
          >
            全部删除
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="history-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
            }}
          />
        </div>
      </div>

      {(overflowNotice || history.length >= HISTORY_MAX) && (
        <p className="history-overflow" role="status">
          历史记录已达 {HISTORY_MAX} 条上限，新记录会顶掉最早的一条；可点击「全部删除」清理。
        </p>
      )}
      {importMsg && <p className="history-import-msg">{importMsg}</p>}

      <div className="history-grid">
        {history.map((entry) => (
          <article key={entry.id} className="card history-card">
            <div className="history-thumb">
              <img
                src={entry.imageUrl}
                alt={entry.text.slice(0, 30)}
                loading="lazy"
                title="点击放大查看"
                onClick={() => setPreviewSrc(entry.imageUrl)}
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.display = 'none';
                  const holder = el.parentElement?.querySelector(
                    '.history-thumb-fallback',
                  ) as HTMLElement | null;
                  if (holder) holder.style.display = 'flex';
                }}
              />
              <span className="history-thumb-fallback">
                图片链接已过期，可重新生成
              </span>
            </div>
            <div className="history-meta">
              <span className={`history-mode mode-${entry.mode}`}>
                {MODE_LABELS[entry.mode]}
              </span>
              <span className="history-time">{formatTime(entry.createdAt)}</span>
            </div>
            <p className="history-topic">{entry.text}</p>
            <div className="history-actions">
              <button
                type="button"
                className="btn-text"
                onClick={() =>
                  setExpandedId(expandedId === entry.id ? null : entry.id)
                }
              >
                {expandedId === entry.id ? '收起提示词' : '回看提示词'}
              </button>
              <button
                type="button"
                className="btn-text"
                onClick={() => onRegenerate(entry)}
              >
                重新生成
              </button>
              <button
                type="button"
                className="btn-text btn-delete"
                onClick={() => onDelete(entry.id)}
              >
                删除
              </button>
            </div>
            {expandedId === entry.id && (
              <pre className="history-prompt">{entry.prompt}</pre>
            )}
          </article>
        ))}
      </div>
      {previewSrc && (
        <ImageLightbox
          src={previewSrc}
          alt="历史图片预览"
          onClose={() => setPreviewSrc(null)}
        />
      )}
    </section>
  );
}
