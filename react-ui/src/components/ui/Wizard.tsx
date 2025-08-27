import React from 'react';
import { X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Button } from './Button';

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Wizard: React.FC<WizardProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  footer,
  size = 'md'
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <Card className={`relative w-full ${sizeClasses[size]} mx-4 max-h-[90vh] overflow-y-auto`}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="rounded-full p-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
        {footer && (
          <div className="border-t px-6 py-4">
            {footer}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Wizard;