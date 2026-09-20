export default function Nav({ model }: { model: string }) {
  return (
    <header className="nav">
      <div className="nav-inner">
        <span className="nav-brand">手绘创图</span>
        <span className="nav-model">
          <span title="图像生成模型">{model}</span>
          <span className="nav-model-sep" aria-hidden="true">
            ·
          </span>
          <span title="视频生成模型">cogvideox-flash</span>
        </span>
      </div>
    </header>
  );
}
