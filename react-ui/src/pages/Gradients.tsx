import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

const Gradients: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Gradients</h1>
        <p className="text-muted-foreground mt-1">
          Create beautiful gradient effects for your lights
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gradient Effects</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page will contain gradient creation and control features. Coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Gradients;