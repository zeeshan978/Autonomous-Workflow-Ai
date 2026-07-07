import { useState, useEffect, memo } from 'react';

export const CursorGlow = memo(function CursorGlow() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let ticking = false;
    const updateMousePosition = (e: MouseEvent) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setMousePosition({ x: e.clientX, y: e.clientY });
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('mousemove', updateMousePosition, { passive: true });
    return () => window.removeEventListener('mousemove', updateMousePosition);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 hidden md:block will-change-transform"
      style={{
        background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, hsl(var(--primary) / 0.05), transparent 40%)`
      }}
    />
  );
});
