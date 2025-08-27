import React, { useEffect, useState } from 'react';
import { 
  Power, Sun, Moon, Sunrise, Sunset, Zap, 
  Sparkles, Home, Play, Plus, ChevronRight,
  Lightbulb, Activity, Timer, Menu
} from 'lucide-react';
import { useGroups } from '@/hooks/useGroups';
import { useScenes } from '@/hooks/useScenes';
import { useLights } from '@/hooks/useLights';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/utils';

// Import design system
import '@/styles/design-system.css';

const DashboardNew: React.FC = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);

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
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Get rooms only
  const roomGroups = groups.filter(g => 
    (g.type === 'Room' || g.type === 'Zone' || g.class) && 
    g.type !== 'Entertainment'
  );

  // Calculate stats
  const totalLightsOn = lights.filter(l => l.isOn).length;
  const energyUsage = lights
    .filter(l => l.isOn)
    .reduce((acc, l) => acc + ((l.brightness || 100) / 100 * 10), 0);

  // Time-based greeting
  const getTimeOfDay = () => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) return { greeting: 'Good Morning', icon: Sunrise, theme: 'warm' };
    if (hour >= 12 && hour < 17) return { greeting: 'Good Afternoon', icon: Sun, theme: 'bright' };
    if (hour >= 17 && hour < 20) return { greeting: 'Good Evening', icon: Sunset, theme: 'sunset' };
    return { greeting: 'Good Night', icon: Moon, theme: 'cool' };
  };

  const timeInfo = getTimeOfDay();
  const TimeIcon = timeInfo.icon;

  // Room control
  const handleRoomToggle = async (groupId: string) => {
    try {
      const group = groups.find(g => g.id === groupId);
      const newState = await toggleGroup(groupId);
      
      if (newState.success) {
        toast.success(`${group?.name} ${newState.data ? 'on' : 'off'}`, {
          icon: newState.data ? '💡' : '🌙',
          style: {
            background: 'var(--imersa-surface)',
            color: '#fff',
            borderRadius: '16px',
          }
        });
        await refreshGroups();
      }
    } catch (error) {
      toast.error('Failed to control room');
    }
  };

  // Scene activation
  const handleSceneActivate = async (sceneId: string) => {
    try {
      const scene = scenes.find(s => s.id === sceneId);
      if (!scene) return;

      const groupId = scene.group || "0";
      const result = await applyGroupAction(groupId, { scene: sceneId });
      
      if (result.success) {
        toast.success(`${scene.name} activated`, {
          icon: '✨',
          style: {
            background: 'var(--imersa-surface)',
            color: '#fff',
            borderRadius: '16px',
          }
        });
      }
    } catch (error) {
      toast.error('Failed to activate scene');
    }
  };

  const handleRoomBrightness = async (groupId: string, brightness: number) => {
    try {
      await setGroupBrightness(groupId, brightness);
    } catch (error) {
      console.error('Failed to set brightness:', error);
    }
  };

  // Get scene colors for gradients
  const getSceneGradient = (sceneName: string) => {
    const name = sceneName.toLowerCase();
    if (name.includes('relax') || name.includes('evening')) return 'var(--gradient-sunset)';
    if (name.includes('energize') || name.includes('bright')) return 'var(--gradient-warm)';
    if (name.includes('concentrate') || name.includes('focus')) return 'var(--gradient-cool)';
    if (name.includes('movie') || name.includes('tv')) return 'var(--gradient-aurora)';
    if (name.includes('night')) return 'var(--gradient-ocean)';
    return 'var(--gradient-warm)';
  };

  return (
    <div className="min-h-screen bg-imersa-void relative overflow-hidden">
      {/* Ambient Background */}
      <div className="ambient-bg">
        <div className="ambient-orb ambient-orb-1"></div>
        <div className="ambient-orb ambient-orb-2"></div>
        <div className="ambient-orb ambient-orb-3"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 p-8 space-y-8">
        
        {/* Header Section */}
        <div className="glass-card p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="nav-orb">
                <TimeIcon className="w-8 h-8 text-imersa-dark" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">
                  {timeInfo.greeting}
                </h1>
                <p className="text-gray-400">
                  {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-imersa-glow-primary">
                  {totalLightsOn}
                </div>
                <div className="text-sm text-gray-400">Lights Active</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-imersa-glow-warm">
                  {roomGroups.filter(r => r.isOn).length}
                </div>
                <div className="text-sm text-gray-400">Rooms Active</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-imersa-glow-cool flex items-center gap-1">
                  <Zap className="w-6 h-6" />
                  {Math.round(energyUsage)}W
                </div>
                <div className="text-sm text-gray-400">Energy Usage</div>
              </div>
            </div>
          </div>

          {/* Quick Controls */}
          <div className="flex gap-4 mt-8">
            <button 
              onClick={() => applyGroupAction("0", { on: true })}
              className="btn-glow flex items-center gap-2"
            >
              <Power className="w-5 h-5" />
              All On
            </button>
            <button 
              onClick={() => applyGroupAction("0", { on: false })}
              className="px-6 py-3 rounded-xl bg-imersa-surface border border-gray-700 text-gray-300 hover:border-imersa-glow-primary transition-all"
            >
              All Off
            </button>
            <button 
              onClick={() => setAllBrightness(50)}
              className="px-6 py-3 rounded-xl bg-imersa-surface border border-gray-700 text-gray-300 hover:border-imersa-glow-cool transition-all flex items-center gap-2"
            >
              <Sun className="w-5 h-5" />
              Dim 50%
            </button>
          </div>
        </div>

        {/* Rooms Grid */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
              <Home className="w-6 h-6 text-imersa-glow-primary" />
              Your Rooms
            </h2>
            <button 
              onClick={() => navigate('/groups')}
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
            >
              Manage <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {roomGroups.map((room) => {
              const lightsInRoom = room.lightIds?.length || 0;
              const isHovered = hoveredRoom === room.id;
              
              return (
                <div
                  key={room.id}
                  className="room-card"
                  onClick={() => handleRoomToggle(room.id)}
                  onMouseEnter={() => setHoveredRoom(room.id)}
                  onMouseLeave={() => setHoveredRoom(null)}
                >
                  {/* Room Icon & Status */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                      room.isOn 
                        ? "bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg" 
                        : "bg-gray-800"
                    )}>
                      <Home className={cn(
                        "w-6 h-6",
                        room.isOn ? "text-gray-900" : "text-gray-400"
                      )} />
                    </div>
                    <div className={cn("status-dot", room.isOn && "active")} />
                  </div>

                  {/* Room Info */}
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {room.name}
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    {room.isOn ? `${lightsInRoom} lights on` : `${lightsInRoom} lights`}
                  </p>

                  {/* Brightness Control (shows on hover when room is on) */}
                  {room.isOn && isHovered && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Brightness</span>
                        <span className="text-white">{room.brightness || 100}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={room.brightness || 100}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleRoomBrightness(room.id, parseInt(e.target.value));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full mt-2 accent-imersa-glow-primary"
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Room Card */}
            <div 
              className="room-card flex items-center justify-center cursor-pointer opacity-60 hover:opacity-100"
              onClick={() => navigate('/groups')}
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-imersa-surface flex items-center justify-center mx-auto mb-3">
                  <Plus className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-400">Add Room</p>
              </div>
            </div>
          </div>
        </div>

        {/* Scenes Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-imersa-glow-purple" />
              Quick Scenes
            </h2>
            <button 
              onClick={() => navigate('/scenes')}
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
            >
              All Scenes <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {scenes.slice(0, 8).map((scene) => (
              <div
                key={scene.id}
                className="scene-card glass-card"
                onClick={() => handleSceneActivate(scene.id)}
              >
                <div 
                  className="scene-gradient"
                  style={{ background: getSceneGradient(scene.name) }}
                />
                <div className="scene-content">
                  <h3 className="text-lg font-semibold text-white">
                    {scene.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Play className="w-4 h-4 text-gray-300" />
                    <span className="text-sm text-gray-300">
                      {scene.lights?.length || 0} lights
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="glass-card p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button 
              onClick={() => navigate('/lights')}
              className="flex items-center justify-between p-4 rounded-xl bg-imersa-surface hover:bg-imersa-elevated transition-all"
            >
              <div className="flex items-center gap-4">
                <Lightbulb className="w-6 h-6 text-imersa-glow-warm" />
                <span className="text-white">Manage Lights</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button 
              onClick={() => navigate('/scheduler')}
              className="flex items-center justify-between p-4 rounded-xl bg-imersa-surface hover:bg-imersa-elevated transition-all"
            >
              <div className="flex items-center gap-4">
                <Timer className="w-6 h-6 text-imersa-glow-cool" />
                <span className="text-white">Set Schedule</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button 
              onClick={() => navigate('/integrations/hub')}
              className="flex items-center justify-between p-4 rounded-xl bg-imersa-surface hover:bg-imersa-elevated transition-all"
            >
              <div className="flex items-center gap-4">
                <Activity className="w-6 h-6 text-imersa-glow-purple" />
                <span className="text-white">Integrations</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardNew;