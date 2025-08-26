import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

const Devices: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Devices</h1>
        <p className="text-muted-foreground mt-1">
          Manage connected devices and bridges
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Device Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page will contain device discovery and management features. Coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Devices;