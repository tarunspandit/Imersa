import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { Button, Input, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { useAuthStore } from '@/stores';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { login, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await login(email, password);
  };

  const fillDefaultCredentials = () => {
    setEmail('admin@diyhue.org');
    setPassword('changeme');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20">
      <div className="w-full max-w-md p-6">
        {/* Logo and brand */}
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 rounded-xl bg-gradient-to-r from-imersa-primary to-imersa-secondary flex items-center justify-center mb-4">
            <span className="text-white font-bold text-2xl">H</span>
          </div>
          <h1 className="text-3xl font-bold text-gradient">DIYHUE LOGIN</h1>
          <p className="text-muted-foreground mt-1">
            Philips Hue Bridge Emulator
          </p>
        </div>

        <Card className="glass-morphism">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-center">
              Sign in to your bridge emulator
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Username"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@diyhue.org"
                required
                leftIcon={<Mail className="h-4 w-4" />}
              />

              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="changeme"
                required
                leftIcon={<Lock className="h-4 w-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                }
              />

              {error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                variant="gradient"
                loading={isLoading}
                disabled={!email || !password}
              >
                Sign In
              </Button>
            </form>
            
            <div className="text-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fillDefaultCredentials}
                className="text-xs"
              >
                Fill Default Credentials
              </Button>
            </div>
            
            <div className="text-center text-xs text-muted-foreground">
              <p>Standard username: admin@diyhue.org / password: changeme</p>
              <p>If lost check documentation</p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-muted-foreground space-y-2">
          <p>Philips Hue Bridge Emulator by diyhue.org</p>
        </div>
      </div>
    </div>
  );
};

export default Login;