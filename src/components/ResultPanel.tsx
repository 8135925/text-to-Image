// 结果区：大图展示 + 重新生成 / 下载 PNG / 复制提示词（spec 2.3）
import { useState } from 'react';
import type { GenerateSuccess } from '../prompts';

interface Props {
  result: GenerateSuccess | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export default function ResultPanel({ result, loading, error, onRetry }: Props) {
  const [imageBroken, setImageBroken] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPrompt = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = `/api/download?url=${encodeURIComponent(result.imageUrl)}`;
    a.download = `ian-image-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (loading) {
    return (
      <section className="card result-card" aria-busy="true">
        <div className="result-placeholder">
          <div className="spinner" aria-hidden="true" />
          <p>正在生成手绘图像，预计 2–5 秒…</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card result-card result-error" role="alert">
        <p>{error}</p>
        <button type="button" className="btn-secondary" onClick={onRetry}>
          重试
        </button>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="card result-card result-empty">
        <p>在左侧粘贴文本，选好风格后点击「开始生成」。</p>
      </section>
    );
  }

  return (
    <section className="card result-card">
      <figure className="result-figure">
        {imageBroken ? (
          <div className="result-broken">
            图片链接已过期，可重新生成
          </div>
        ) : (
          <img
            src={result.imageUrl}
            alt="生成结果"
            onError={() => setImageBroken(true)}
          />
        )}
      </figure>
      <div className="result-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={onRetry}
          disabled={loading}
        >
          重新生成
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={download}
          disabled={imageBroken}
        >
          下载 PNG
        </button>
        <button type="button" className="btn-secondary" onClick={copyPrompt}>
          {copied ? '已复制' : '复制提示词'}
        </button>
      </div>
      <details className="result-prompt">
        <summary>查看完整提示词</summary>
        <pre>{result.prompt}</pre>
      </details>
    </section>
  );
}
