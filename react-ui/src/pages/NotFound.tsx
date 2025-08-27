import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Search, AlertTriangle } from 'lucide-react';
import '@/styles/design-system.css';
import { cn } from '@/utils';

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-imersa-void relative overflow-hidden flex items-center justify-center">
      {/* Ambient Background */}
      <div className="ambient-bg">
        <div className="ambient-orb ambient-orb-1"></div>
        <div className="ambient-orb ambient-orb-2"></div>
        <div className="ambient-orb ambient-orb-3"></div>
      </div>
      
      <div className="glass-card w-full max-w-md text-center p-8 space-y-6 relative z-10">
          {/* 404 Animation/Illustration */}
          <div className="relative">
            <div className="text-8xl font-bold text-white/10">404</div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center animate-pulse">
                <AlertTriangle className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>

          {/* Error message */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">Page Not Found</h1>
            <p className="text-gray-400">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => navigate(-1)}
              className="w-full px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="w-full btn-glow flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Go to Dashboard
            </button>
          </div>

          {/* Helpful links */}
          <div className="pt-4 border-t border-white/10">
            <p className="text-sm text-gray-400 mb-3">
              Looking for something specific?
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <button
                onClick={() => navigate('/lights')}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
              >
                Lights
              </button>
              <button
                onClick={() => navigate('/scenes')}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
              >
                Scenes
              </button>
              <button
                onClick={() => navigate('/groups')}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
              >
                Groups
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
              >
                Settings
              </button>
            </div>
          </div>
      </div>
    </div>
  );
};

export default NotFound;