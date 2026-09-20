// 历史卡片网格：最近 20 条，点击回看提示词、重新生成（spec 2.3）
import { useState } from 'react';
import type { HistoryEntry } from '../lib/history';
import { MODE_LABELS } from '../prompts';
import ImageLightbox from './ImageLightbox';

interface Props {
  history: HistoryEntry[];
  onRegenerate: (entry: HistoryEntry) => void;
  onClearAll: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function HistoryGrid({ history, onRegenerate, onClearAll }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  if (history.length === 0) {
    return null;
  }

  const handleClear = () => {
    if (window.confirm(`确定删除全部 ${history.length} 条历史记录吗？此操作不可恢复。`)) {
      onClearAll();
      setExpandedId(null);
    }
  };

  return (
    <section className="history">
      <div className="history-header">
        <h2 className="history-title">历史记录</h2>
        <button
          type="button"
          className="btn-clear-history"
          onClick={handleClear}
        >
          全部删除
        </button>
      </div>
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
