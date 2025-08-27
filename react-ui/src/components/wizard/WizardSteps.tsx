// Multi-step Wizard Navigation Component
import React from 'react';
import { Check, Circle } from 'lucide-react';
import { WizardStep } from '@/hooks/useWizard';
import { cn } from '@/utils';
import '@/styles/design-system.css';

interface WizardStepsProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (stepNumber: number) => void;
  progress: number;
  className?: string;
}

export const WizardSteps: React.FC<WizardStepsProps> = ({
  steps,
  currentStep,
  onStepClick,
  progress,
  className,
}) => {
  return (
    <div className={cn('w-full glass-card p-6', className)}>
      {/* Progress Bar */}
      <div className="w-full bg-white/10 rounded-full h-2 mb-6">
        <div 
          className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.isCompleted;
          const isPast = step.id < currentStep;
          const isClickable = onStepClick && (isPast || step.isValid);

          return (
            <div key={step.id} className="flex flex-col items-center flex-1">
              {/* Step Circle */}
              <div
                className={cn(
                  'relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200',
                  isCompleted
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : isActive
                    ? 'bg-gradient-to-br from-yellow-400 to-orange-500 border-yellow-400 text-gray-900'
                    : isPast
                    ? 'bg-imersa-surface border-gray-600 text-gray-300'
                    : 'bg-imersa-void border-gray-700 text-gray-400',
                  isClickable && 'cursor-pointer hover:scale-105 interactive-glow'
                )}
                onClick={() => isClickable && onStepClick(step.id)}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-medium">{step.id}</span>
                )}
                
                {/* Active Step Pulse Effect */}
                {isActive && (
                  <div className="absolute inset-0 rounded-full border-2 border-yellow-400/50 animate-pulse" />
                )}
              </div>

              {/* Step Content */}
              <div className="mt-3 text-center">
                <div
                  className={cn(
                    'text-sm font-medium',
                    isActive
                      ? 'text-imersa-glow-primary'
                      : isCompleted
                      ? 'text-emerald-400'
                      : 'text-gray-400'
                  )}
                >
                  {step.title}
                </div>
                <div
                  className={cn(
                    'text-xs mt-1 max-w-24',
                    isActive
                      ? 'text-yellow-400/80'
                      : isCompleted
                      ? 'text-emerald-400/80'
                      : 'text-gray-500'
                  )}
                >
                  {step.description}
                </div>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="absolute top-5 left-1/2 w-full h-0.5 bg-white/10 -z-10">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      step.isCompleted
                        ? 'bg-emerald-500'
                        : isActive && progress > (step.id - 1) * 25
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-500'
                        : 'bg-white/10'
                    )}
                    style={{
                      width: isCompleted ? '100%' : isActive ? `${Math.min(100, (progress - (step.id - 1) * 25) * 4)}%` : '0%'
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current Step Info */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white mb-2">
          {steps.find(s => s.id === currentStep)?.title}
        </h2>
        <p className="text-gray-400 text-sm">
          {steps.find(s => s.id === currentStep)?.description}
        </p>
      </div>
    </div>
  );
};

export default WizardSteps;