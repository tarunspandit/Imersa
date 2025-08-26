import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

const Analytics: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          View usage statistics and system performance
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page will contain analytics and performance metrics. Coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;