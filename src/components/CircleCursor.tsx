import React, { useEffect, useRef, useState } from 'react';

export interface CustomCursorProps {
  color?: string;
  shape?: 'square' | 'circle';
  filled?: boolean;
}

export const CustomCursor: React.FC<CustomCursorProps> = ({
  color,
  shape = 'circle',
  filled = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isPressed, setIsPressed] = useState<boolean>(false);
  const [isFinePointer, setIsFinePointer] = useState<boolean>(true);

  const isHoveredRef = useRef<boolean>(false);
  const isVisibleRef = useRef<boolean>(false);

  useEffect(() => {
    // Check if the current environment has a fine pointer (mouse / trackpad)
    const mql = window.matchMedia('(pointer: fine)');
    setIsFinePointer(mql.matches);

    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsFinePointer(e.matches);
    };

    mql.addEventListener('change', handleMediaChange);

    if (!mql.matches) {
      return () => {
        mql.removeEventListener('change', handleMediaChange);
      };
    }

    // Activate custom cursor styling on root
    document.documentElement.classList.add('custom-cursor');

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;

      if (!isVisibleRef.current) {
        isVisibleRef.current = true;
        setIsVisible(true);
      }

      if (containerRef.current) {
        containerRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }

      const target = e.target as HTMLElement | null;
      const interactive = !!target?.closest(
        'button, a, input, select, textarea, [role="button"], .cursor-pointer, [data-cursor-hover], summary, label'
      );

      if (interactive !== isHoveredRef.current) {
        isHoveredRef.current = interactive;
        setIsHovered(interactive);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      setIsPressed(true);
    };

    const onPointerUp = () => {
      setIsPressed(false);
    };

    const onMouseLeave = () => {
      isVisibleRef.current = false;
      setIsVisible(false);
    };

    const onMouseEnter = () => {
      isVisibleRef.current = true;
      setIsVisible(true);
    };

    const onBlur = () => {
      isVisibleRef.current = false;
      setIsVisible(false);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseenter', onMouseEnter);
    window.addEventListener('blur', onBlur);

    return () => {
      mql.removeEventListener('change', handleMediaChange);
      document.documentElement.classList.remove('custom-cursor');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  if (!isFinePointer) {
    return null;
  }

  const cursorColor = color || 'var(--sand-color, #c4bdb2)';

  // Sizing for cursor
  let size = shape === 'circle' ? 14 : 12; // Default size (px)
  if (isHovered) {
    size = shape === 'circle' ? 34 : 28; // Expanded over clickable elements
  } else if (isPressed) {
    size = shape === 'circle' ? 9 : 8; // Snapped on click / press
  }

  const isSquare = shape === 'square';

  // Render at the largest state and scale down. Animating width/height would
  // trigger layout every hover; scale() is composite-only. Border and shadow
  // are divided by the scale so their on-screen size stays constant.
  const baseSize = shape === 'circle' ? 34 : 28;
  const scale = Math.max(size / baseSize, 0.05);
  const invScale = 1 / scale;

  return (
    <div
      ref={containerRef}
      className="fixed top-0 left-0 pointer-events-none z-[99999] will-change-transform"
      style={{
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.2s ease-out',
      }}
      aria-hidden="true"
    >
      <div
        className={`relative -translate-x-1/2 -translate-y-1/2 flex items-center justify-center ${
          isSquare ? 'rounded-none' : 'rounded-full'
        }`}
        style={{
          width: `${baseSize}px`,
          height: `${baseSize}px`,
          backgroundColor: filled ? cursorColor : 'transparent',
          border: filled ? 'none' : `${(1.5 * invScale).toFixed(2)}px solid ${cursorColor}`,
          mixBlendMode: 'difference',
          boxShadow: isHovered
            ? `0 0 ${(14 * invScale).toFixed(1)}px rgba(255, 255, 255, 0.2)`
            : `0 0 ${(6 * invScale).toFixed(1)}px rgba(0, 0, 0, 0.4)`,
          transform: `scale(${isPressed ? scale * 0.85 : scale})`,
          transition: 'transform 150ms ease-out',
        }}
      />
    </div>
  );
};

