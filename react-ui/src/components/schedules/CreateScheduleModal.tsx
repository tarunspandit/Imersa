import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { CreateScheduleRequest, ScheduleTemplate, LightGroup, Scene } from '@/types';
import { useGroups } from '@/hooks/useGroups';
import { useScenes } from '@/hooks/useScenes';
import { Clock, Calendar, Sun, Moon, Timer, Repeat, Layout, Lightbulb, Palette } from 'lucide-react';

interface CreateScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (schedule: CreateScheduleRequest) => Promise<boolean>;
  templates: ScheduleTemplate[];
  editSchedule?: {
    id: string;
    name: string;
    description?: string;
    time?: string;
    type?: string;
    command: any;
  } | null;
}

const CreateScheduleModal: React.FC<CreateScheduleModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  templates,
  editSchedule
}) => {
  const { groups } = useGroups();
  const { scenes } = useScenes();
  
  // Form state
  const [formData, setFormData] = useState<CreateScheduleRequest>({
    name: '',
    description: '',
    time: '19:00',
    type: 'one-time',
    command: {
      address: '',
      method: 'PUT',
      body: {}
    },
    status: 'enabled',
    days: [],
    offset: 0,
    randomization: 0
  });
  
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [commandType, setCommandType] = useState<'group' | 'light' | 'scene'>('group');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [actionType, setActionType] = useState<'on' | 'off' | 'scene' | 'custom'>('on');
  const [customAction, setCustomAction] = useState('{}');
  const [loading, setLoading] = useState(false);
  
  // Reset form when modal opens/closes or edit schedule changes
  useEffect(() => {
    if (isOpen) {
      if (editSchedule) {
        setFormData({
          name: editSchedule.name,
          description: editSchedule.description || '',
          time: editSchedule.time || '19:00',
          type: (editSchedule.type as any) || 'one-time',
          command: editSchedule.command,
          status: 'enabled',
          days: [],
          offset: 0,
          randomization: 0
        });
      } else {
        setFormData({
          name: '',
          description: '',
          time: '19:00',
          type: 'one-time',
          command: {
            address: '',
            method: 'PUT',
            body: {}
          },
          status: 'enabled',
          days: [],
          offset: 0,
          randomization: 0
        });
      }
      setSelectedTemplate('');
      setSelectedTarget('');
      setCustomAction('{}');
    }
  }, [isOpen, editSchedule]);

  // Apply template
  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        ...template.template,
        name: prev.name || template.name,
        description: prev.description || template.description
      }));
      setSelectedTemplate(templateId);
    }
  };

  // Update command based on selections
  useEffect(() => {
    if (!selectedTarget) return;

    let address = '';
    let body: any = {};

    if (commandType === 'group') {
      address = `/api/{key}/groups/${selectedTarget}/action`;
      if (actionType === 'on') {
        body = { on: true, bri: 200 };
      } else if (actionType === 'off') {
        body = { on: false };
      } else if (actionType === 'scene') {
        body = { scene: selectedTarget };
      } else if (actionType === 'custom') {
        try {
          body = JSON.parse(customAction);
        } catch {
          body = {};
        }
      }
    }

    setFormData(prev => ({
      ...prev,
      command: {
        ...prev.command,
        address,
        body
      }
    }));
  }, [commandType, selectedTarget, actionType, customAction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const success = await onSubmit(formData);
      if (success) {
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (day: number) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days?.includes(day) 
        ? prev.days.filter(d => d !== day)
        : [...(prev.days || []), day]
    }));
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const scheduleTypes = [
    { value: 'one-time', label: 'One Time', icon: Timer },
    { value: 'daily', label: 'Daily', icon: Repeat },
    { value: 'weekly', label: 'Weekly', icon: Calendar },
    { value: 'sunrise', label: 'Sunrise', icon: Sun },
    { value: 'sunset', label: 'Sunset', icon: Moon }
  ];

  return (
    <Modal open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModalContent size="xl">
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-6">
          {editSchedule ? 'Edit Schedule' : 'Create Schedule'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Templates Section */}
          {!editSchedule && templates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layout className="h-5 w-5" />
                  Quick Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {templates.map(template => (
                    <Button
                      key={template.id}
                      type="button"
                      variant={selectedTemplate === template.id ? "default" : "outline"}
                      onClick={() => applyTemplate(template.id)}
                      className="h-auto p-3 flex flex-col gap-1"
                    >
                      <span className="text-lg">{template.icon}</span>
                      <span className="text-sm">{template.name}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Schedule Name</label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Morning lights"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
          </div>

          {/* Schedule Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Schedule Type</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {scheduleTypes.map(type => {
                const Icon = type.icon;
                return (
                  <Button
                    key={type.value}
                    type="button"
                    variant={formData.type === type.value ? "default" : "outline"}
                    onClick={() => setFormData(prev => ({ ...prev, type: type.value as any }))}
                    className="flex flex-col gap-1 h-auto p-3"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{type.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Time Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                {formData.type === 'sunrise' || formData.type === 'sunset' ? 'Offset (minutes)' : 'Time'}
              </label>
              {formData.type === 'sunrise' || formData.type === 'sunset' ? (
                <Input
                  type="number"
                  value={formData.offset}
                  onChange={(e) => setFormData(prev => ({ ...prev, offset: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
              ) : (
                <Input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  required
                />
              )}
            </div>
            
            {formData.type !== 'one-time' && (
              <div>
                <label className="block text-sm font-medium mb-2">Randomization (minutes)</label>
                <Input
                  type="number"
                  value={formData.randomization}
                  onChange={(e) => setFormData(prev => ({ ...prev, randomization: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                  min="0"
                  max="120"
                />
              </div>
            )}
          </div>

          {/* Weekly Days Selection */}
          {formData.type === 'weekly' && (
            <div>
              <label className="block text-sm font-medium mb-2">Days of Week</label>
              <div className="flex gap-2">
                {dayNames.map((day, index) => (
                  <Button
                    key={index}
                    type="button"
                    variant={formData.days?.includes(index) ? "default" : "outline"}
                    onClick={() => handleDayToggle(index)}
                    size="sm"
                    className="w-12"
                  >
                    {day}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Action Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Action Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Target Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Target Type</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={commandType === 'group' ? "default" : "outline"}
                    onClick={() => setCommandType('group')}
                    size="sm"
                  >
                    Groups
                  </Button>
                  <Button
                    type="button"
                    variant={commandType === 'scene' ? "default" : "outline"}
                    onClick={() => setCommandType('scene')}
                    size="sm"
                  >
                    <Palette className="h-4 w-4 mr-1" />
                    Scenes
                  </Button>
                </div>
              </div>

              {/* Target Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {commandType === 'group' ? 'Select Group' : 'Select Scene'}
                </label>
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Select...</option>
                  {commandType === 'group' && 
                    Object.values(groups).map(group => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))
                  }
                  {commandType === 'scene' && 
                    Object.values(scenes).map(scene => (
                      <option key={scene.id} value={scene.id}>{scene.name}</option>
                    ))
                  }
                </select>
              </div>

              {/* Action Type */}
              {commandType === 'group' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Action</label>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant={actionType === 'on' ? "default" : "outline"}
                      onClick={() => setActionType('on')}
                      size="sm"
                    >
                      Turn On
                    </Button>
                    <Button
                      type="button"
                      variant={actionType === 'off' ? "default" : "outline"}
                      onClick={() => setActionType('off')}
                      size="sm"
                    >
                      Turn Off
                    </Button>
                    <Button
                      type="button"
                      variant={actionType === 'custom' ? "default" : "outline"}
                      onClick={() => setActionType('custom')}
                      size="sm"
                    >
                      Custom
                    </Button>
                  </div>
                </div>
              )}

              {/* Custom Action */}
              {actionType === 'custom' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Custom Action JSON</label>
                  <textarea
                    value={customAction}
                    onChange={(e) => setCustomAction(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md h-24 font-mono text-sm"
                    placeholder='{"on": true, "bri": 200, "ct": 300}'
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Example: &#123;"on": true, "bri": 150, "hue": 10000&#125;
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.name || !selectedTarget}
            >
              {loading ? 'Creating...' : (editSchedule ? 'Update Schedule' : 'Create Schedule')}
            </Button>
          </div>
        </form>
      </div>
      </ModalContent>
    </Modal>
  );
};

export default CreateScheduleModal;
