export default function Nav({ model }: { model: string }) {
  return (
    <header className="nav">
      <div className="nav-inner">
        <span className="nav-brand">Ian 手绘图像生成器</span>
        <span className="nav-model">{model}</span>
      </div>
    </header>
  );
}
