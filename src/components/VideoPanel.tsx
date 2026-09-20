// 视频结果区：加载中 / 出错 / 完成（<video> 播放）（spec 2.3）
interface Props {
  state: 'idle' | 'loading' | 'error' | 'done';
  videoUrl: string | null;
  coverUrl: string | null;
  error: string | null;
  onRetry: () => void;
  onDismiss: () => void;
}

export default function VideoPanel({
  state,
  videoUrl,
  coverUrl,
  error,
  onRetry,
  onDismiss,
}: Props) {
  if (state === 'idle') return null;

  if (state === 'loading') {
    return (
      <section className="card video-card" aria-busy="true">
        <div className="result-placeholder">
          <div className="spinner" aria-hidden="true" />
          <p>正在生成手绘视频，通常需要 1–3 分钟…</p>
        </div>
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section className="card video-card result-error" role="alert">
        <p>{error ?? '视频生成失败'}</p>
        <div className="result-actions">
          <button type="button" className="btn-secondary" onClick={onRetry}>
            重试
          </button>
          <button type="button" className="btn-secondary" onClick={onDismiss}>
            关闭
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card video-card">
      <div className="video-card-head">
        <h3 className="video-title">生成视频</h3>
        <button
          type="button"
          className="btn-text"
          onClick={onDismiss}
        >
          关闭
        </button>
      </div>
      <figure className="video-figure">
        <video
          src={videoUrl ?? undefined}
          poster={coverUrl ?? undefined}
          controls
          playsInline
          preload="metadata"
        />
      </figure>
      <p className="video-hint">
        视频链接有时效，建议及时观看；关闭后可在历史中重新生成。
      </p>
    </section>
  );
}
