import { useCallback, useEffect, useRef, useState } from 'react';
import Nav from './components/Nav';
import Hero from './components/Hero';
import ResultPanel from './components/ResultPanel';
import HistoryGrid from './components/HistoryGrid';
import Footer from './components/Footer';
import { loadHistory, addHistory, clearHistory } from './lib/history';
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
  const lastRequestRef = useRef<RequestPayload | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
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
        setHistory(
          addHistory({
            mode: payload.mode,
            text: payload.text,
            prompt: data.prompt,
            imageUrl: data.imageUrl,
            createdAt: data.createdAt,
          }),
        );
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
  }, []);

  const textLen = [...text].length;
  // config 请求异常时按 hasKey=true 处理，由 /api/generate 的 E_NO_KEY 兜底
  const keyOk = config?.hasKey ?? true;
  const canGenerate = !loading && textLen > 0 && keyOk;

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

            <button
              type="button"
              className="btn-generate"
              onClick={onGenerate}
              disabled={!canGenerate}
              aria-busy={loading}
            >
              {loading ? '生成中…' : '开始生成'}
              <span className="btn-generate-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </div>

          {/* 右：生成结果 */}
          <div className="ws-result">
            <ResultPanel
              result={result}
              loading={loading}
              error={error}
              onRetry={onRetry}
            />
          </div>
        </section>

        <HistoryGrid
          history={history}
          onRegenerate={onHistoryRegenerate}
          onClearAll={onClearHistory}
        />
      </main>

      <Footer />
    </div>
  );
}
