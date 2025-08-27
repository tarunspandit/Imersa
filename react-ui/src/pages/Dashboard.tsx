import React, { useEffect, useState } from 'react';
import { 
  Lightbulb, 
  Layers, 
  Play, 
  Zap, 
  TrendingUp, 
  Activity,
  Clock,
  Wifi,
  Power,
  Sun,
  Moon,
  Palette,
  Home
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@/components/ui';
import { QuickActionBar, presetActions } from '@/components/ui/QuickActionBar';
import { useLightsStore, useAppStore } from '@/stores';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { lights, groups, scenes, fetchLights, fetchGroups, fetchScenes } = useLightsStore();
  const { addNotification } = useAppStore();
  const navigate = useNavigate();
  const [showQuickActions, setShowQuickActions] = useState(true);

  useEffect(() => {
    // Fetch all data on mount
    const fetchData = async () => {
      try {
        await Promise.all([
          fetchLights(),
          fetchGroups(),
          fetchScenes(),
        ]);
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Data Fetch Error',
          message: 'Failed to load dashboard data',
        });
      }
    };

    fetchData();
  }, [fetchLights, fetchGroups, fetchScenes, addNotification]);

  // Calculate statistics
  const stats = {
    totalLights: lights.length,
    onlineLights: lights.filter(light => light.status === 'online').length,
    activeLights: lights.filter(light => light.isOn).length,
    totalGroups: groups.length,
    activeGroups: groups.filter(group => group.isOn).length,
    totalScenes: scenes.length,
    activeScenes: scenes.filter(scene => scene.isActive).length,
  };

  const recentLights = lights.slice(0, 5);
  const recentScenes = scenes.slice(0, 4);

  return (
    <div className="p-6 space-y-6 pb-24">
      {/* Welcome header */}
      <div>
        <h1 className="text-3xl font-bold text-gradient">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome to your Imersa lighting control center
        </p>
      </div>

      {/* Statistics cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Lights</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLights}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">{stats.onlineLights} online</span>
              {' • '}
              <span className="text-blue-600">{stats.activeLights} active</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Groups</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalGroups}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-blue-600">{stats.activeGroups} active</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scenes</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalScenes}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-purple-600">{stats.activeScenes} running</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Online</div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Lights */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Lights</CardTitle>
            <CardDescription>
              Your most recently added or updated lights
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentLights.length > 0 ? (
              <div className="space-y-4">
                {recentLights.map((light) => {
                  const r = (light as any)?.color?.r ?? 200;
                  const g = (light as any)?.color?.g ?? 200;
                  const b = (light as any)?.color?.b ?? 200;
                  const brand = (light as any)?.brand ?? (light as any)?.manufacturername ?? 'Unknown';
                  const type = (light as any)?.type ?? (light as any)?.model ?? 'Light';
                  return (
                  <div
                    key={light.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
                        />
                        <Wifi className={`h-4 w-4 ${
                          light.status === 'online' ? 'text-green-500' : 'text-red-500'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium">{light.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {type} • {brand}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {light.brightness}%
                      </p>
                      <p className={`text-xs ${
                        light.isOn ? 'text-green-600' : 'text-muted-foreground'
                      }`}>
                        {light.isOn ? 'On' : 'Off'}
                      </p>
                    </div>
                  </div>
                )})}
                <div className="pt-2">
                  <Button variant="outline" className="w-full">
                    View All Lights
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No lights found</p>
                <p className="text-sm">Add your first light to get started</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" variant="outline">
              <Lightbulb className="h-4 w-4 mr-2" />
              Add New Light
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Layers className="h-4 w-4 mr-2" />
              Create Group
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Play className="h-4 w-4 mr-2" />
              New Scene
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Zap className="h-4 w-4 mr-2" />
              WLED Setup
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Scenes */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Scenes</CardTitle>
          <CardDescription>
            Your most recently created or used scenes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentScenes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {recentScenes.map((scene) => (
                <Card key={scene.id} hover className="cursor-pointer">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium truncate">{scene.name}</h3>
                        <div className={`w-2 h-2 rounded-full ${
                          scene.isActive ? 'bg-green-500' : 'bg-gray-300'
                        }`} />
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {scene.description || 'No description'}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{(scene as any).lightSettings?.length ?? (scene as any).lights?.length ?? 0} lights</span>
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {new Date(scene.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No scenes created yet</p>
              <p className="text-sm">Create your first scene to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default Dashboard;
