import React, { useEffect, useRef } from 'react';
import { cn } from '@/utils';

interface ParticleFieldProps {
  count?: number;
  className?: string;
  active?: boolean;
}

export const ParticleField: React.FC<ParticleFieldProps> = ({ 
  count = 30, 
  className,
  active = false 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !active) return;

    const container = containerRef.current;
    container.innerHTML = '';

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 25 + 's';
      particle.style.animationDuration = (15 + Math.random() * 10) + 's';
      
      // Vary particle sizes
      const size = 2 + Math.random() * 4;
      particle.style.width = size + 'px';
      particle.style.height = size + 'px';
      
      // Random colors from our palette
      const colors = [
        'var(--imersa-glow-primary)',
        'var(--imersa-glow-warm)',
        'var(--imersa-glow-cool)',
        'var(--imersa-glow-purple)'
      ];
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      
      container.appendChild(particle);
    }

    return () => {
      container.innerHTML = '';
    };
  }, [count, active]);

  if (!active) return null;

  return (
    <div 
      ref={containerRef}
      className={cn("particle-container", className)}
      aria-hidden="true"
    />
  );
};

export default ParticleField;