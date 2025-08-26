import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

const Settings: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your Imersa system preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page will contain system configuration and user preferences. Coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;