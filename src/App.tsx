import { useCallback, useEffect, useRef, useState } from 'react';
import Nav from './components/Nav';
import Hero from './components/Hero';
import ResultPanel from './components/ResultPanel';
import VideoPanel from './components/VideoPanel';
import HistoryGrid from './components/HistoryGrid';
import Footer from './components/Footer';
import {
  ensureSeeded,
  addHistory,
  clearHistory,
  deleteEntry,
} from './lib/history';
import type { HistoryEntry } from './lib/history';
import {
  MODE_LABELS,
  MODE_HINTS,
  TEXT_MAX_LEN,
  type Mode,
  type GenerateResponse,
  type GenerateSuccess,
} from './prompts';

interface ConfigInfo {
  model: string;
  hasKey: boolean;
  modes: string[];
}

interface RequestPayload {
  mode: Mode;
  text: string;
}

export default function App() {
  const [config, setConfig] = useState<ConfigInfo | null>(null);
  const [mode, setMode] = useState<Mode>('xiaohei');
  const [text, setText] = useState('小狗在追蝴蝶');
  const [result, setResult] = useState<GenerateSuccess | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOverflow, setHistoryOverflow] = useState(false);
  // 视频生成状态（cogvideox-flash 异步任务）
  const [videoState, setVideoState] = useState<
    'idle' | 'loading' | 'error' | 'done'
  >('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoCover, setVideoCover] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const pollCountRef = useRef(0);
  const lastRequestRef = useRef<RequestPayload | null>(null);

  useEffect(() => {
    // 冷启动：localStorage 为空时从 seed-history.json 加载内置历史
    ensureSeeded().then((list) => setHistory(list));
    fetch('/api/config')
      .then((r) => r.json())
      .then((c: ConfigInfo) => setConfig(c))
      .catch(() =>
        setConfig({ model: 'cogview-3-flash', hasKey: false, modes: [] }),
      );
  }, []);

  const generate = useCallback(async (payload: RequestPayload) => {
    lastRequestRef.current = payload;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as GenerateResponse;
      if (data.success) {
        setResult(data);
        const added = addHistory({
          mode: payload.mode,
          text: payload.text,
          prompt: data.prompt,
          imageUrl: data.imageUrl,
          createdAt: data.createdAt,
        });
        setHistory(added.list);
        setHistoryOverflow(added.overflow);
      } else {
        setError(data.message);
      }
    } catch {
      setError('网络异常，请检查连接后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  const onGenerate = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    void generate({ mode, text: trimmed });
  }, [generate, loading, mode, text]);

  // ---------- 视频生成（cogvideox-flash，异步任务轮询） ----------

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const pollTask = useCallback(
    (taskId: string) => {
      pollCountRef.current += 1;
      if (pollCountRef.current > 100) {
        // 100 次 × 3s = 5 分钟超时
        stopPolling();
        setVideoState('error');
        setVideoError('生成超时（超过 5 分钟），请重试');
        return;
      }
      pollTimerRef.current = window.setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/generate-video?taskId=${encodeURIComponent(taskId)}`,
          );
          const data = (await res.json()) as {
            success: boolean;
            status?: string;
            videoUrl?: string;
            coverUrl?: string;
            message?: string;
          };
          if (!data.success) {
            stopPolling();
            setVideoState('error');
            setVideoError(data.message ?? '视频生成失败');
            return;
          }
          if (data.status === 'FAIL') {
            stopPolling();
            setVideoState('error');
            setVideoError('视频生成失败（内容审核未通过或上游错误），请调整文本后重试');
            return;
          }
          if (data.status === 'SUCCESS' && data.videoUrl) {
            stopPolling();
            setVideoUrl(data.videoUrl);
            setVideoCover(data.coverUrl ?? null);
            setVideoState('done');
            return;
          }
          pollTask(taskId); // PROCESSING，继续轮询
        } catch {
          pollTask(taskId); // 网络抖动，继续轮询
        }
      }, 3000);
    },
    [stopPolling],
  );

  const generateVideo = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || videoState === 'loading') return;
    stopPolling();
    pollCountRef.current = 0;
    setVideoState('loading');
    setVideoError(null);
    setVideoUrl(null);
    setVideoCover(null);
    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, text: trimmed }),
      });
      const data = (await res.json()) as {
        success: boolean;
        taskId?: string;
        message?: string;
      };
      if (!data.success || !data.taskId) {
        setVideoState('error');
        setVideoError(data.message ?? '提交视频任务失败');
        return;
      }
      pollTask(data.taskId);
    } catch {
      setVideoState('error');
      setVideoError('网络异常，请检查连接后重试');
    }
  }, [mode, pollTask, stopPolling, text, videoState]);

  const onVideoRetry = useCallback(() => {
    void generateVideo();
  }, [generateVideo]);

  const onVideoDismiss = useCallback(() => {
    stopPolling();
    setVideoState('idle');
  }, [stopPolling]);

  const onRetry = useCallback(() => {
    if (lastRequestRef.current) void generate(lastRequestRef.current);
  }, [generate]);

  const onHistoryRegenerate = useCallback(
    (entry: HistoryEntry) => {
      void generate({ mode: entry.mode, text: entry.text });
    },
    [generate],
  );

  const onClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    setHistoryOverflow(false);
  }, []);

  const onImportHistory = useCallback((list: HistoryEntry[]) => {
    setHistory(list);
    setHistoryOverflow(false);
  }, []);

  const onDeleteEntry = useCallback((id: string) => {
    setHistory(deleteEntry(id));
  }, []);

  const textLen = [...text].length;
  // config 请求异常时按 hasKey=true 处理，由 /api/generate 的 E_NO_KEY 兜底
  const keyOk = config?.hasKey ?? true;
  // 图片/视频互不阻塞：只要求有文本和 Key，各自的 loading 态单独防重复提交
  const canGenerate = textLen > 0 && keyOk;

  return (
    <div className="app">
      <Nav model={config?.model ?? ''} />
      <Hero />

      <main className="main">
        {/* 三栏工作台：左文本 | 中控制 | 右结果 */}
        <section className="workspace">
          {/* 左：大段文本输入 */}
          <div className="ws-input card">
            <label htmlFor="source-text" className="ws-input-label">
              输入要配图的文本
            </label>
            <textarea
              id="source-text"
              value={text}
              maxLength={TEXT_MAX_LEN}
              placeholder={'粘贴一段文章、想法或工作流描述…\n\n例如：内容工作流里，人负责选题和判断，机器负责抓取和初筛，最后人工再润色定稿。重复性的分拣工作交给自动化后，创作节奏明显变快了。'}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="ws-input-footer">
              <span>{MODE_HINTS[mode]}</span>
              <span className={textLen > TEXT_MAX_LEN - 200 ? 'warn' : ''}>
                {textLen} / {TEXT_MAX_LEN}
              </span>
            </div>
          </div>

          {/* 中：风格切换 + 开始生成 */}
          <div className="ws-controls">
            <div className="style-switch" role="tablist" aria-label="绘画风格">
              {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  className={`style-chip${mode === m ? ' active' : ''}`}
                  onClick={() => setMode(m)}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>

            <div className="ws-generate-group">
              <button
                type="button"
                className="btn-generate"
                onClick={onGenerate}
                disabled={!canGenerate || loading}
                aria-busy={loading}
              >
                {loading ? '生成中…' : '开始生成'}
                <span className="btn-generate-arrow" aria-hidden="true">
                  →
                </span>
              </button>
              <button
                type="button"
                className={`btn-video${videoState === 'loading' ? ' is-loading' : ''}`}
                onClick={() => void generateVideo()}
                disabled={!canGenerate || videoState === 'loading'}
              >
                {videoState === 'loading' ? (
                  <>
                    <span className="btn-video-spinner" aria-hidden="true" />
                    <span className="btn-video-label">视频生成中</span>
                    <span className="btn-video-dots" aria-hidden="true">
                      <i>.</i>
                      <i>.</i>
                      <i>.</i>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="btn-video-play" aria-hidden="true" />
                    生成视频
                    <span className="btn-video-sub">CogVideoX · 5s</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 右：生成结果（图片 + 视频） */}
          <div className="ws-result">
            <div className="ws-result-stack">
              <ResultPanel
                result={result}
                loading={loading}
                error={error}
                onRetry={onRetry}
              />
              <VideoPanel
                state={videoState}
                videoUrl={videoUrl}
                coverUrl={videoCover}
                error={videoError}
                onRetry={onVideoRetry}
                onDismiss={onVideoDismiss}
              />
            </div>
          </div>
        </section>

        <HistoryGrid
          history={history}
          onRegenerate={onHistoryRegenerate}
          onClearAll={onClearHistory}
          onImport={onImportHistory}
          onDelete={onDeleteEntry}
          overflowNotice={historyOverflow}
          onDismissOverflow={() => setHistoryOverflow(false)}
        />
      </main>

      <Footer />
    </div>
  );
}
