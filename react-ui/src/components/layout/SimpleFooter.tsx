import React from 'react';
import { Coffee, Heart } from 'lucide-react';

export const SimpleFooter: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-white/5 bg-imersa-surface/50 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-400">
          <div className="flex items-center gap-1">
            <span>Designed with</span>
            <Heart className="h-3 w-3 fill-red-500 text-red-500" />
            <span>by</span>
            <a 
              href="https://flow7.org" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-medium text-imersa-glow-primary hover:text-imersa-glow-warm transition-colors"
            >
              Flow7
            </a>
          </div>
          
          <a
            href="https://buymeacoffee.com/tarunspandit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-400/10 to-orange-500/10 hover:from-yellow-400/20 hover:to-orange-500/20 text-imersa-glow-warm transition-all"
          >
            <Coffee className="h-4 w-4" />
            <span className="font-medium">Buy me a coffee</span>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default SimpleFooter;