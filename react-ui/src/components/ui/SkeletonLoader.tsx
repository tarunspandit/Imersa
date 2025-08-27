import React from 'react';
import { cn } from '@/utils';

interface SkeletonLoaderProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
  count?: number;
  animate?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className,
  variant = 'rectangular',
  width,
  height,
  count = 1,
  animate = true
}) => {
  const baseClasses = cn(
    'bg-muted',
    animate && 'animate-pulse',
    className
  );

  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
    card: 'rounded-lg'
  };

  const style = {
    width: width || (variant === 'circular' ? '40px' : '100%'),
    height: height || (variant === 'text' ? '16px' : variant === 'circular' ? '40px' : '120px')
  };

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(baseClasses, variantClasses[variant])}
          style={style}
        />
      ))}
    </>
  );
};

// Preset skeleton components for common use cases
export const CardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('p-4 border rounded-lg space-y-3', className)}>
    <div className="flex items-center justify-between">
      <SkeletonLoader variant="text" width="60%" />
      <SkeletonLoader variant="circular" width={24} height={24} />
    </div>
    <SkeletonLoader variant="text" count={2} />
    <SkeletonLoader variant="rectangular" height={80} />
    <div className="flex gap-2">
      <SkeletonLoader variant="rectangular" height={32} />
      <SkeletonLoader variant="rectangular" height={32} />
    </div>
  </div>
);

export const LightCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('p-4 border rounded-lg space-y-3', className)}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <SkeletonLoader variant="circular" width={32} height={32} />
        <SkeletonLoader variant="text" width={120} />
      </div>
      <SkeletonLoader variant="rectangular" width={48} height={24} />
    </div>
    <SkeletonLoader variant="rectangular" height={40} />
    <div className="flex gap-2">
      <SkeletonLoader variant="text" width="30%" />
      <SkeletonLoader variant="text" width="30%" />
      <SkeletonLoader variant="text" width="30%" />
    </div>
  </div>
);

export const TableRowSkeleton: React.FC<{ columns?: number; className?: string }> = ({ 
  columns = 5, 
  className 
}) => (
  <div className={cn('flex items-center gap-4 p-3 border-b', className)}>
    {Array.from({ length: columns }).map((_, index) => (
      <SkeletonLoader 
        key={index} 
        variant="text" 
        width={index === 0 ? '20%' : index === columns - 1 ? '10%' : 'auto'}
      />
    ))}
  </div>
);

export const ListSkeleton: React.FC<{ 
  items?: number; 
  className?: string 
}> = ({ items = 5, className }) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: items }).map((_, index) => (
      <div key={index} className="flex items-center gap-3 p-3 border rounded">
        <SkeletonLoader variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <SkeletonLoader variant="text" width="70%" />
          <SkeletonLoader variant="text" width="40%" height={12} />
        </div>
        <SkeletonLoader variant="rectangular" width={80} height={32} />
      </div>
    ))}
  </div>
);

export default SkeletonLoader;