import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/ui';

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardContent className="p-8 space-y-6">
          {/* 404 Animation/Illustration */}
          <div className="relative">
            <div className="text-8xl font-bold text-muted-foreground/20">404</div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-gradient-to-r from-imersa-primary to-imersa-secondary flex items-center justify-center">
                <Search className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>

          {/* Error message */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Page Not Found</h1>
            <p className="text-muted-foreground">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="w-full"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Go Back
            </Button>
            
            <Button
              onClick={() => navigate('/')}
              variant="gradient"
              className="w-full"
              leftIcon={<Home className="h-4 w-4" />}
            >
              Go to Dashboard
            </Button>
          </div>

          {/* Helpful links */}
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-3">
              Looking for something specific?
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <button
                onClick={() => navigate('/lights')}
                className="p-2 rounded-md hover:bg-accent transition-colors"
              >
                Lights
              </button>
              <button
                onClick={() => navigate('/scenes')}
                className="p-2 rounded-md hover:bg-accent transition-colors"
              >
                Scenes
              </button>
              <button
                onClick={() => navigate('/groups')}
                className="p-2 rounded-md hover:bg-accent transition-colors"
              >
                Groups
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="p-2 rounded-md hover:bg-accent transition-colors"
              >
                Settings
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;