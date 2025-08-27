import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Settings, 
  Save, 
  X, 
  Plus, 
  Trash2, 
  AlertTriangle,
  Clock,
  Zap,
  Bell,
  MapPin
} from 'lucide-react';
import { Button, Card, Input, Switch } from '@/components/ui';
import type { Sensor, SensorThreshold } from '@/types/sensors';
import { cn } from '@/utils';

interface SensorConfigProps {
  sensor: Sensor;
  onSave: (sensorId: string, config: Partial<Sensor['config']>, thresholds?: SensorThreshold[]) => Promise<void>;
  onClose: () => void;
  isOpen: boolean;
}

interface ConfigFormData {
  name: string;
  enabled: boolean;
  sensitivity: number;
  timeout: number;
  calibrationOffset: number;
  units: string;
  reportingInterval: number;
  changeThreshold: number;
  room: string;
  zone: string;
}

const SensorConfig: React.FC<SensorConfigProps> = ({
  sensor,
  onSave,
  onClose,
  isOpen
}) => {
  const [thresholds, setThresholds] = useState<SensorThreshold[]>(sensor.thresholds || []);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'thresholds' | 'automation'>('basic');

  const { register, handleSubmit, reset, watch, formState: { isDirty } } = useForm<ConfigFormData>({
    defaultValues: {
      name: sensor.name,
      enabled: sensor.config.enabled,
      sensitivity: sensor.config.sensitivity || 50,
      timeout: sensor.config.timeout || 300,
      calibrationOffset: sensor.config.calibrationOffset || 0,
      units: sensor.config.units || '',
      reportingInterval: sensor.config.reportingInterval || 60,
      changeThreshold: sensor.config.changeThreshold || 0.1,
      room: sensor.room || '',
      zone: sensor.zone || '',
    }
  });

  // Reset form when sensor changes
  useEffect(() => {
    reset({
      name: sensor.name,
      enabled: sensor.config.enabled,
      sensitivity: sensor.config.sensitivity || 50,
      timeout: sensor.config.timeout || 300,
      calibrationOffset: sensor.config.calibrationOffset || 0,
      units: sensor.config.units || '',
      reportingInterval: sensor.config.reportingInterval || 60,
      changeThreshold: sensor.config.changeThreshold || 0.1,
      room: sensor.room || '',
      zone: sensor.zone || '',
    });
    setThresholds(sensor.thresholds || []);
  }, [sensor, reset]);

  const onSubmit = async (data: ConfigFormData) => {
    setIsLoading(true);
    try {
      const config: Partial<Sensor['config']> = {
        enabled: data.enabled,
        sensitivity: data.sensitivity,
        timeout: data.timeout,
        calibrationOffset: data.calibrationOffset,
        units: data.units,
        reportingInterval: data.reportingInterval,
        changeThreshold: data.changeThreshold,
      };

      await onSave(sensor.id, config, thresholds);
      onClose();
    } catch (error) {
      console.error('Failed to save sensor configuration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addThreshold = () => {
    const newThreshold: SensorThreshold = {
      id: `threshold_${Date.now()}`,
      type: 'max',
      value: 0,
      action: 'alert',
      enabled: true,
    };
    setThresholds([...thresholds, newThreshold]);
  };

  const updateThreshold = (index: number, updates: Partial<SensorThreshold>) => {
    const updated = [...thresholds];
    updated[index] = { ...updated[index], ...updates };
    setThresholds(updated);
  };

  const removeThreshold = (index: number) => {
    setThresholds(thresholds.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Settings className="h-5 w-5" />
            <div>
              <h2 className="text-xl font-semibold">Sensor Configuration</h2>
              <p className="text-sm text-muted-foreground">{sensor.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <nav className="flex space-x-4 px-6 py-3">
            {['basic', 'thresholds', 'automation'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-md transition-colors capitalize",
                  activeTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Basic Configuration */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                {/* General Settings */}
                <div>
                  <h3 className="text-lg font-medium mb-4">General Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Name</label>
                      <Input
                        {...register('name', { required: true })}
                        placeholder="Sensor name"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">Enabled</label>
                        <p className="text-sm text-muted-foreground">
                          Enable or disable this sensor
                        </p>
                      </div>
                      <Switch {...register('enabled')} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Room</label>
                        <Input
                          {...register('room')}
                          placeholder="Living Room"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Zone</label>
                        <Input
                          {...register('zone')}
                          placeholder="Zone A"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sensor-specific Settings */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Sensor Settings</h3>
                  <div className="space-y-4">
                    {sensor.capabilities.hasMotion && (
                      <>
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Sensitivity ({watch('sensitivity')}%)
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            className="w-full"
                            {...register('sensitivity', { valueAsNumber: true })}
                          />
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>Low</span>
                            <span>High</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Timeout (seconds)
                          </label>
                          <Input
                            type="number"
                            min="0"
                            {...register('timeout', { valueAsNumber: true })}
                            placeholder="300"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Time to wait before marking as inactive
                          </p>
                        </div>
                      </>
                    )}

                    {(sensor.capabilities.hasTemperature || sensor.capabilities.hasLightLevel) && (
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Calibration Offset
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          {...register('calibrationOffset', { valueAsNumber: true })}
                          placeholder="0"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Adjust readings by this amount
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-2">Units</label>
                      <Input
                        {...register('units')}
                        placeholder="°C, lux, %"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Reporting Interval (seconds)
                        </label>
                        <Input
                          type="number"
                          min="1"
                          {...register('reportingInterval', { valueAsNumber: true })}
                          placeholder="60"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Change Threshold
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...register('changeThreshold', { valueAsNumber: true })}
                          placeholder="0.1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Thresholds Configuration */}
            {activeTab === 'thresholds' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Alert Thresholds</h3>
                  <Button type="button" onClick={addThreshold} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Threshold
                  </Button>
                </div>

                {thresholds.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                    <p>No thresholds configured</p>
                    <p className="text-sm">Add thresholds to get alerts when sensor values exceed limits</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {thresholds.map((threshold, index) => (
                      <Card key={threshold.id} className="p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={threshold.enabled}
                              onCheckedChange={(checked) => updateThreshold(index, { enabled: !!checked })}
                            />
                            <span className="font-medium">
                              Threshold {index + 1}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeThreshold(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Type</label>
                            <select
                              className="w-full px-3 py-2 border rounded-md"
                              value={threshold.type}
                              onChange={(e) => updateThreshold(index, { type: e.target.value as any })}
                            >
                              <option value="min">Minimum</option>
                              <option value="max">Maximum</option>
                              <option value="range">Range</option>
                              <option value="change">Change</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">Value</label>
                            {threshold.type === 'range' ? (
                              <div className="flex space-x-2">
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={Array.isArray(threshold.value) ? threshold.value[0] : 0}
                                  onChange={(e) => {
                                    const current = Array.isArray(threshold.value) ? threshold.value : [0, 0];
                                    updateThreshold(index, { value: [parseFloat(e.target.value), current[1]] });
                                  }}
                                  placeholder="Min"
                                />
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={Array.isArray(threshold.value) ? threshold.value[1] : 0}
                                  onChange={(e) => {
                                    const current = Array.isArray(threshold.value) ? threshold.value : [0, 0];
                                    updateThreshold(index, { value: [current[0], parseFloat(e.target.value)] });
                                  }}
                                  placeholder="Max"
                                />
                              </div>
                            ) : (
                              <Input
                                type="number"
                                step="0.1"
                                value={Array.isArray(threshold.value) ? threshold.value[0] : threshold.value}
                                onChange={(e) => updateThreshold(index, { value: parseFloat(e.target.value) })}
                              />
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">Action</label>
                            <select
                              className="w-full px-3 py-2 border rounded-md"
                              value={threshold.action}
                              onChange={(e) => updateThreshold(index, { action: e.target.value as any })}
                            >
                              <option value="alert">Alert</option>
                              <option value="trigger_scene">Trigger Scene</option>
                              <option value="notification">Notification</option>
                            </select>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Automation Tab */}
            {activeTab === 'automation' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Automation Settings</h3>
                
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="h-8 w-8 mx-auto mb-2" />
                  <p>Automation configuration</p>
                  <p className="text-sm">This feature will be available in a future update</p>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-muted/30">
          <div className="text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 inline mr-1" />
            {sensor.manufacturer} {sensor.model}
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit(onSubmit)}
              disabled={!isDirty || isLoading}
              className="min-w-[100px]"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export { SensorConfig };