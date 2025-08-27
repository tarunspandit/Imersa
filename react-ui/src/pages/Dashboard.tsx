import React, { useEffect, useState } from 'react';
import { 
  Home,
  Power,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Zap,
  Activity,
  Users,
  Play,
  Plus,
  Lightbulb,
  BedDouble,
  Tv,
  Coffee,
  BookOpen,
  ChevronRight,
  Sparkles,
  Timer,
  Loader2,
  Bath,
  DoorOpen,
  Sofa
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { useGroups } from '@/hooks/useGroups';
import { useScenes } from '@/hooks/useScenes';
import { useLights } from '@/hooks/useLights';
import { useAppStore } from '@/stores';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/utils';

interface ScenePreset {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);

  // Use real hooks for data
  const {
    groups,
    isLoading: groupsLoading,
    toggleGroup,
    setGroupBrightness,
    applyGroupAction,
    refreshGroups
  } = useGroups({ autoRefresh: true, refreshInterval: 5000 });

  const {
    scenes,
    recallScene,
    refreshScenes
  } = useScenes({ autoRefresh: true, refreshInterval: 10000 });

  const {
    lights,
    allLightsOn,
    allLightsOff,
    setAllBrightness
  } = useLights(true, 5000);

  useEffect(() => {
    // Update time every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Get room groups (not entertainment groups)
  const roomGroups = groups.filter(g => 
    (g.type === 'Room' || g.type === 'Zone' || g.class) && 
    g.type !== 'Entertainment'
  );

  // Calculate stats
  const totalLightsOn = lights.filter(l => l.isOn).length;
  // Power estimate: assuming 10W bulbs at full brightness (not accurate, just visual)
  const totalPower = lights
    .filter(l => l.isOn)
    .reduce((acc, l) => {
      const brightness = l.brightness || 100;
      return acc + (brightness / 100 * 10); // Estimated 10W per bulb
    }, 0);

  // Get room icon based on class/name
  const getRoomIcon = (group: any) => {
    const name = group.name?.toLowerCase() || '';
    const roomClass = group.class?.toLowerCase() || '';
    
    if (name.includes('living') || roomClass.includes('living')) return Sofa;
    if (name.includes('bedroom') || roomClass.includes('bedroom')) return BedDouble;
    if (name.includes('kitchen') || roomClass.includes('kitchen')) return Coffee;
    if (name.includes('office') || roomClass.includes('office')) return BookOpen;
    if (name.includes('bath') || roomClass.includes('bath')) return Bath;
    if (name.includes('hall') || roomClass.includes('hall') || name.includes('corridor')) return DoorOpen;
    if (name.includes('dining') || roomClass.includes('dining')) return Coffee;
    return Home;
  };

  // Get time-based greeting and suggestions
  const getTimeBasedContent = () => {
    const hour = currentTime.getHours();
    
    if (hour >= 5 && hour < 12) {
      return {
        greeting: 'Good morning',
        icon: Sunrise,
        suggestion: 'Start your day with energizing light',
        suggestedScene: 'Energize'
      };
    } else if (hour >= 12 && hour < 17) {
      return {
        greeting: 'Good afternoon',
        icon: Sun,
        suggestion: 'Keep focused with bright, cool light',
        suggestedScene: 'Concentrate'
      };
    } else if (hour >= 17 && hour < 20) {
      return {
        greeting: 'Good evening',
        icon: Sunset,
        suggestion: 'Wind down with warm, dim lighting',
        suggestedScene: 'Relax'
      };
    } else {
      return {
        greeting: 'Good night',
        icon: Moon,
        suggestion: 'Prepare for sleep with minimal light',
        suggestedScene: 'Nightlight'
      };
    }
  };

  const timeContent = getTimeBasedContent();
  const TimeIcon = timeContent.icon;

  // Handle room toggle
  const handleRoomToggle = async (groupId: string) => {
    try {
      const group = groups.find(g => g.id === groupId);
      const newState = await toggleGroup(groupId);
      
      if (newState.success) {
        toast.success(newState.data ? `${group?.name} turned on` : `${group?.name} turned off`);
        await refreshGroups();
      } else {
        toast.error('Failed to toggle room');
      }
    } catch (error) {
      toast.error('Failed to control room');
    }
  };

  // Handle scene activation  
  const handleSceneActivate = async (sceneId?: string, sceneName?: string, groupId?: string) => {
    try {
      // Find scene by name if ID not provided
      let targetScene = sceneId ? scenes.find(s => s.id === sceneId) : null;
      if (!targetScene && sceneName) {
        targetScene = scenes.find(s => s.name.toLowerCase().includes(sceneName.toLowerCase()));
      }

      if (!targetScene) {
        toast.error('Scene not found');
        return;
      }

      // Use the scene's group, or group "0" for all lights if no specific group
      const targetGroupId = groupId || targetScene.group || "0";
      
      // In diyHue, scenes are applied to groups via action endpoint
      const result = await applyGroupAction(targetGroupId, { scene: targetScene.id });
      if (result.success) {
        toast.success(`Scene "${targetScene.name}" activated`);
        await refreshGroups();
      } else {
        toast.error('Failed to activate scene');
      }
    } catch (error) {
      console.error('Scene activation error:', error);
      toast.error('Failed to activate scene');
    }
  };

  // Handle all lights control - Group "0" is special group for all lights
  const handleAllLightsOn = async () => {
    try {
      // Use group "0" which controls all lights in diyHue
      const result = await toggleGroup("0");
      if (!result.success) {
        // If group 0 doesn't exist or fails, try fallback
        await allLightsOn();
      }
      toast.success('All lights turned on');
      await refreshGroups();
      await refreshLights();
    } catch (error) {
      toast.error('Failed to turn on all lights');
    }
  };

  const handleAllLightsOff = async () => {
    try {
      // Use group "0" which controls all lights in diyHue
      await applyGroupAction("0", { on: false });
      toast.success('All lights turned off');
      await refreshGroups();
      await refreshLights();
    } catch (error) {
      toast.error('Failed to turn off all lights');
    }
  };

  const handleDim50 = async () => {
    try {
      await setAllBrightness(50);
      toast.success('All lights dimmed to 50%');
      setRefreshKey(k => k + 1);
    } catch (error) {
      toast.error('Failed to dim lights');
    }
  };

  // Get favorite/recent scenes (limit to 4)
  const favoriteScenes = scenes.slice(0, 4).map(scene => {
    // Try to guess scene type from name
    const name = scene.name.toLowerCase();
    let icon = Play;
    let color = 'bg-blue-500';
    
    if (name.includes('movie') || name.includes('tv')) {
      icon = Tv;
      color = 'bg-purple-500';
    } else if (name.includes('dinner') || name.includes('dining')) {
      icon = Coffee;
      color = 'bg-orange-500';
    } else if (name.includes('relax') || name.includes('chill')) {
      icon = Sparkles;
      color = 'bg-green-500';
    } else if (name.includes('read') || name.includes('work') || name.includes('focus')) {
      icon = BookOpen;
      color = 'bg-blue-500';
    }

    return {
      id: scene.id,
      name: scene.name,
      icon,
      color,
      description: scene.description || `${scene.lights?.length || 0} lights`
    };
  });

  if (groupsLoading && groups.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 pb-20">
      {/* Time-based header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <TimeIcon className="h-8 w-8 text-yellow-500" />
            <span>{timeContent.greeting}!</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            {timeContent.suggestion}
          </p>
        </div>
        
        {/* Energy & Status */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Lights Active</p>
            <p className="text-2xl font-bold">{totalLightsOn}/{lights.length}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Power Usage</p>
            <p className="text-2xl font-bold flex items-center gap-1">
              <Zap className="h-5 w-5 text-yellow-500" />
              ~{totalPower.toFixed(0)}W
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        <Button
          size="lg"
          variant={totalLightsOn > 0 ? "default" : "outline"}
          onClick={handleAllLightsOn}
          className="whitespace-nowrap"
        >
          <Power className="h-4 w-4 mr-2" />
          All On
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={handleAllLightsOff}
          className="whitespace-nowrap"
        >
          <Power className="h-4 w-4 mr-2" />
          All Off
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => handleSceneActivate(undefined, timeContent.suggestedScene)}
          className="whitespace-nowrap"
        >
          <TimeIcon className="h-4 w-4 mr-2" />
          {timeContent.suggestedScene}
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={handleDim50}
          className="whitespace-nowrap"
        >
          <Sun className="h-4 w-4 mr-2" />
          Dim 50%
        </Button>
      </div>

      {/* Main Grid - Rooms and Scenes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Rooms Section - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Rooms</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/groups')}
            >
              Manage
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          {roomGroups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roomGroups.map((room) => {
                const RoomIcon = getRoomIcon(room);
                const lightsInRoom = room.lightIds?.length || room.lights?.length || 0;
                const lightsOn = room.isOn ? lightsInRoom : 0; // Simplified - if group is on, assume all lights on
                
                return (
                  <Card 
                    key={room.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-lg",
                      room.isOn && "ring-2 ring-yellow-500/20"
                    )}
                    onClick={() => handleRoomToggle(room.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            room.isOn ? "bg-yellow-500/20" : "bg-muted"
                          )}>
                            <RoomIcon className={cn(
                              "h-5 w-5",
                              room.isOn ? "text-yellow-600" : "text-muted-foreground"
                            )} />
                          </div>
                          <div>
                            <h3 className="font-medium">{room.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {room.isOn ? `${lightsInRoom} lights on` : `${lightsInRoom} lights`}
                            </p>
                          </div>
                        </div>
                        <Power className={cn(
                          "h-5 w-5",
                          room.isOn ? "text-yellow-500" : "text-muted-foreground"
                        )} />
                      </div>
                      
                      {room.isOn && room.brightness !== undefined && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Brightness</span>
                          <span className="font-medium">{room.brightness}%</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              
              {/* Add Room Card */}
              <Card 
                className="cursor-pointer border-dashed hover:border-solid hover:shadow-lg transition-all"
                onClick={() => navigate('/groups')}
              >
                <CardContent className="p-4 flex items-center justify-center h-full min-h-[100px]">
                  <div className="text-center">
                    <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Add Room</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Home className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-lg font-medium mb-1">No rooms configured</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create rooms to organize your lights
                </p>
                <Button onClick={() => navigate('/groups')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Room
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Scenes and Status */}
        <div className="space-y-6">
          {/* Favorite Scenes */}
          {scenes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Quick Scenes</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/scenes')}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {favoriteScenes.map((scene) => {
                  const SceneIcon = scene.icon;
                  return (
                    <Button
                      key={scene.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSceneActivate(scene.id);
                      }}
                    >
                      <div className={cn("p-1 rounded mr-3", scene.color)}>
                        <SceneIcon className="h-4 w-4 text-white" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-medium">{scene.name}</p>
                        <p className="text-xs text-muted-foreground">{scene.description}</p>
                      </div>
                    </Button>
                  );
                })}
                
                {scenes.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-2">No scenes created yet</p>
                    <Button 
                      size="sm" 
                      onClick={() => navigate('/scenes')}
                    >
                      Create Scene
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Lights</span>
                  <span className="font-medium">{lights.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Active Now</span>
                  <span className="font-medium text-green-600">
                    {totalLightsOn}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Groups</span>
                  <span className="font-medium">{groups.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Scenes</span>
                  <span className="font-medium">{scenes.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Setup */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/lights')}
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                Add New Lights
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/scheduler')}
              >
                <Timer className="h-4 w-4 mr-2" />
                Set Schedule
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/integrations')}
              >
                <Users className="h-4 w-4 mr-2" />
                Integrations
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
