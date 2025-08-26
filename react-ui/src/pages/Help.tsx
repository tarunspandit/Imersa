import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

const Help: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Help</h1>
        <p className="text-muted-foreground mt-1">
          Get help and support for using Imersa
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Help Center</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page will contain documentation, tutorials, and support resources. Coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Help;