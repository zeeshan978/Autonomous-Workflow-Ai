import { useEffect, useRef } from 'react';

export function ParticleTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    window.addEventListener('resize', resize);
    resize();

    const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f472b6'];
    
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      color: string;
      size: number;
    }

    let particles: Particle[] = [];
    let animationFrameId: number;
    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (Math.random() <= 0.6) {
        particles.push({
          x: mouseX,
          y: mouseY,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          life: 1,
          maxLife: 30 + Math.random() * 20,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 3 + Math.random() * 2
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        if (p.life <= -p.maxLife) {
          particles.splice(i, 1);
          continue;
        }

        const progress = Math.max(0, (p.maxLife + p.life) / p.maxLife);
        const opacity = progress * 0.8;
        
        if (opacity > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = opacity;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      animationFrameId = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-50"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
