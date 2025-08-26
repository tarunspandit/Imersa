import React from 'react';
import { Heart, Github, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-6">
        {/* Main footer content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand section */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="h-6 w-6 rounded bg-gradient-to-r from-imersa-primary to-imersa-secondary flex items-center justify-center">
                <span className="text-white font-bold text-xs">I</span>
              </div>
              <span className="font-semibold text-lg text-gradient">Imersa</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Advanced lighting control and management system for smart homes and entertainment.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                  Dashboard
                </a>
              </li>
              <li>
                <a href="/lights" className="text-muted-foreground hover:text-foreground transition-colors">
                  Lights
                </a>
              </li>
              <li>
                <a href="/scenes" className="text-muted-foreground hover:text-foreground transition-colors">
                  Scenes
                </a>
              </li>
              <li>
                <a href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
                  Settings
                </a>
              </li>
            </ul>
          </div>

          {/* Features */}
          <div>
            <h3 className="font-semibold mb-3">Features</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/entertainment" className="text-muted-foreground hover:text-foreground transition-colors">
                  Entertainment Groups
                </a>
              </li>
              <li>
                <a href="/wled" className="text-muted-foreground hover:text-foreground transition-colors">
                  WLED Integration
                </a>
              </li>
              <li>
                <a href="/gradients" className="text-muted-foreground hover:text-foreground transition-colors">
                  Gradient Effects
                </a>
              </li>
              <li>
                <a href="/scheduler" className="text-muted-foreground hover:text-foreground transition-colors">
                  Scheduling
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold mb-3">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/help" className="text-muted-foreground hover:text-foreground transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com/imersa/imersa" 
                  className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a href="/api/docs" className="text-muted-foreground hover:text-foreground transition-colors">
                  API Documentation
                </a>
              </li>
              <li>
                <a href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom section */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-6 mt-6 border-t">
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span>© {currentYear} Imersa. All rights reserved.</span>
            <div className="hidden md:flex items-center space-x-1">
              <span>Made with</span>
              <Heart className="h-4 w-4 text-red-500 fill-current" />
              <span>for smart lighting enthusiasts</span>
            </div>
          </div>

          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            {/* System status indicator */}
            <div className="flex items-center space-x-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-muted-foreground">System Online</span>
            </div>

            {/* GitHub link */}
            <Button
              variant="ghost"
              size="icon"
              asChild
            >
              <a
                href="https://github.com/imersa/imersa"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View on GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* Mobile "Made with love" */}
        <div className="md:hidden flex items-center justify-center space-x-1 text-sm text-muted-foreground mt-4">
          <span>Made with</span>
          <Heart className="h-4 w-4 text-red-500 fill-current" />
          <span>for smart lighting enthusiasts</span>
        </div>
      </div>
    </footer>
  );
};

export { Footer };