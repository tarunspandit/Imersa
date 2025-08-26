import React from 'react';
import { ScenePreview as ScenePreviewType } from '@/types';
import { Card } from '@/components/ui';
import { Lightbulb, Palette } from 'lucide-react';

interface ScenePreviewProps {
  preview: ScenePreviewType;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ScenePreview: React.FC<ScenePreviewProps> = ({
  preview,
  className = '',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-16 h-12',
    md: 'w-24 h-16',
    lg: 'w-32 h-20',
  };

  return (
    <Card className={`${className} ${sizeClasses[size]} p-0 overflow-hidden relative group cursor-pointer hover:scale-105 transition-transform`}>
      {/* Thumbnail */}
      <div className="w-full h-full relative">
        <img
          src={preview.thumbnail}
          alt={`Scene ${preview.sceneId} preview`}
          className="w-full h-full object-cover"
        />
        
        {/* Overlay with stats */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white text-center">
            <div className="flex items-center gap-1 text-xs">
              <Lightbulb className="w-3 h-3" />
              <span>{preview.lightsCount}</span>
            </div>
            <div className="flex items-center gap-1 text-xs mt-1">
              <Palette className="w-3 h-3" />
              <span>{Math.round(preview.brightness)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Color palette indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-1 flex">
        {preview.colors.slice(0, 5).map((color, index) => (
          <div
            key={index}
            className="flex-1 h-full"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </Card>
  );
};