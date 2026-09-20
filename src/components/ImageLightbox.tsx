// 图片放大预览灯箱：点击遮罩 / 右上角按钮 / Esc 关闭
// 可选 prev/next：提供时显示左右箭头，支持键盘 ←/→ 翻页
import { useEffect } from 'react';

interface Props {
  src: string;
  alt: string;
  onClose: () => void;
  /** 上一张（不提供则不显示左箭头） */
  onPrev?: () => void;
  /** 下一张（不提供则不显示右箭头） */
  onNext?: () => void;
  /** 位置指示，如 "3 / 10" */
  position?: string;
}

export default function ImageLightbox({
  src,
  alt,
  onClose,
  onPrev,
  onNext,
  position,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', onKey);
    // 打开时锁定页面滚动
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, onNext, onPrev]);

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      onClick={onClose}
    >
      <button
        type="button"
        className="lightbox-close"
        aria-label="关闭预览"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        ×
      </button>

      {position && <span className="lightbox-position">{position}</span>}

      {onPrev && (
        <button
          type="button"
          className="lightbox-nav lightbox-nav-prev"
          aria-label="上一张"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
        >
          ‹
        </button>
      )}

      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
      />

      {onNext && (
        <button
          type="button"
          className="lightbox-nav lightbox-nav-next"
          aria-label="下一张"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
        >
          ›
        </button>
      )}
    </div>
  );
}
