import React, { useEffect, useRef, useState } from 'react';

interface CircleCursorProps {
  color?: string;
}

export const CircleCursor: React.FC<CircleCursorProps> = ({ color }) => {
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

  // Calculate diameter and styles based on state
  let size = 26; // Default ring diameter (px)
  if (isHovered) {
    size = 46; // Expanded over clickable elements
  } else if (isPressed) {
    size = 20; // Snapped on press / click
  }

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
        className="relative -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center transition-all duration-150 ease-out"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          border: `1.5px solid ${cursorColor}`,
          backgroundColor: isHovered
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(255, 255, 255, 0.02)',
          boxShadow: isHovered
            ? '0 0 16px rgba(255, 255, 255, 0.12)'
            : '0 0 8px rgba(0, 0, 0, 0.4)',
          transform: isPressed ? 'scale(0.92)' : 'scale(1)',
        }}
      >
        {/* Subtle center precision dot */}
        <div
          className="rounded-full transition-all duration-150 ease-out"
          style={{
            width: isHovered ? '4px' : '3px',
            height: isHovered ? '4px' : '3px',
            backgroundColor: cursorColor,
            opacity: isHovered ? 0.35 : 0.85,
          }}
        />
      </div>
    </div>
  );
};
