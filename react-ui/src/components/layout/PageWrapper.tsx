import React from 'react';
import '@/styles/design-system.css';
import { cn } from '@/utils';

interface PageWrapperProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageWrapper: React.FC<PageWrapperProps> = ({
  children,
  icon,
  title,
  subtitle,
  actions,
  className
}) => {
  return (
    <div className="min-h-screen bg-imersa-void relative overflow-hidden">
      {/* Ambient Background */}
      <div className="ambient-bg">
        <div className="ambient-orb ambient-orb-1"></div>
        <div className="ambient-orb ambient-orb-2"></div>
        <div className="ambient-orb ambient-orb-3"></div>
      </div>

      <div className={cn("relative z-10 p-8 space-y-6", className)}>
        {/* Header */}
        {(icon || title || subtitle || actions) && (
          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {icon && (
                  <div className="nav-orb">
                    {icon}
                  </div>
                )}
                {(title || subtitle) && (
                  <div>
                    {title && <h1 className="text-3xl font-bold text-white">{title}</h1>}
                    {subtitle && <p className="text-gray-400 mt-1">{subtitle}</p>}
                  </div>
                )}
              </div>
              {actions && (
                <div className="flex items-center gap-3">
                  {actions}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        {children}
      </div>
    </div>
  );
};

export default PageWrapper;