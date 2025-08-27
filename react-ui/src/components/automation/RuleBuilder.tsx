import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { CreateRuleRequest, RuleCondition, RuleAction, RuleTemplate } from '@/types';
import { Plus, Zap, AlertCircle, Settings, Target, Clock, Trash2 } from 'lucide-react';

interface RuleBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rule: CreateRuleRequest) => Promise<boolean>;
  templates: RuleTemplate[];
  availableAddresses?: {
    sensors: Array<{ address: string; name: string; type: string }>;
    groups: Array<{ address: string; name: string }>;
    lights: Array<{ address: string; name: string }>;
    scenes: Array<{ address: string; name: string }>;
  };
  editRule?: {
    id: string;
    name: string;
    description?: string;
    conditions: RuleCondition[];
    actions: RuleAction[];
    enabled: boolean;
  } | null;
}

const RuleBuilder: React.FC<RuleBuilderProps> = ({
  isOpen,
  onClose,
  onSubmit,
  templates,
  availableAddresses,
  editRule
}) => {
  const [formData, setFormData] = useState<CreateRuleRequest>({
    name: '',
    description: '',
    conditions: [{ address: '', operator: 'eq', value: '' }],
    actions: [{ address: '', method: 'PUT', body: {} }],
    enabled: true
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Reset form when modal opens/closes or edit rule changes
  useEffect(() => {
    if (isOpen) {
      if (editRule) {
        setFormData({
          name: editRule.name,
          description: editRule.description || '',
          conditions: editRule.conditions,
          actions: editRule.actions,
          enabled: editRule.enabled
        });
      } else {
        setFormData({
          name: '',
          description: '',
          conditions: [{ address: '', operator: 'eq', value: '' }],
          actions: [{ address: '', method: 'PUT', body: {} }],
          enabled: true
        });
      }
      setSelectedTemplate('');
      setValidationErrors([]);
    }
  }, [isOpen, editRule]);

  // Apply template
  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template && template.template) {
      setFormData(prev => ({
        ...prev,
        ...template.template,
        name: prev.name || template.name,
        description: prev.description || template.description
      }));
      setSelectedTemplate(templateId);
    }
  };

  // Condition management
  const addCondition = () => {
    setFormData(prev => ({
      ...prev,
      conditions: [...prev.conditions, { address: '', operator: 'eq', value: '' }]
    }));
  };

  const removeCondition = (index: number) => {
    if (formData.conditions.length > 1) {
      setFormData(prev => ({
        ...prev,
        conditions: prev.conditions.filter((_, i) => i !== index)
      }));
    }
  };

  const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.map((condition, i) => 
        i === index ? { ...condition, ...updates } : condition
      )
    }));
  };

  // Action management
  const addAction = () => {
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, { address: '', method: 'PUT', body: {} }]
    }));
  };

  const removeAction = (index: number) => {
    if (formData.actions.length > 1) {
      setFormData(prev => ({
        ...prev,
        actions: prev.actions.filter((_, i) => i !== index)
      }));
    }
  };

  const updateAction = (index: number, updates: Partial<RuleAction>) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.map((action, i) => 
        i === index ? { ...action, ...updates } : action
      )
    }));
  };

  // Validation
  const validateRule = (): string[] => {
    const errors: string[] = [];

    if (!formData.name?.trim()) {
      errors.push('Rule name is required');
    }

    if (formData.conditions.length === 0) {
      errors.push('At least one condition is required');
    }

    if (formData.actions.length === 0) {
      errors.push('At least one action is required');
    }

    formData.conditions.forEach((condition, index) => {
      if (!condition.address) {
        errors.push(`Condition ${index + 1}: Address is required`);
      }
      if (!condition.operator) {
        errors.push(`Condition ${index + 1}: Operator is required`);
      }
    });

    formData.actions.forEach((action, index) => {
      if (!action.address) {
        errors.push(`Action ${index + 1}: Address is required`);
      }
      if (!action.method) {
        errors.push(`Action ${index + 1}: Method is required`);
      }
    });

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateRule();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setLoading(true);
    setValidationErrors([]);

    try {
      const success = await onSubmit(formData);
      if (success) {
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const operators = [
    { value: 'eq', label: 'Equals (==)' },
    { value: 'gt', label: 'Greater than (>)' },
    { value: 'lt', label: 'Less than (<)' },
    { value: 'dx', label: 'Changed' },
    { value: 'ddx', label: 'Changed again' },
    { value: 'stable', label: 'Stable for' },
    { value: 'not stable', label: 'Not stable for' },
    { value: 'in', label: 'In range' },
    { value: 'not in', label: 'Not in range' }
  ];

  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE'];

  const getAddressOptions = () => {
    if (!availableAddresses) return [];
    
    const options = [
      ...availableAddresses.sensors.map(s => ({ 
        value: s.address, 
        label: `${s.name} (${s.type})`,
        group: 'Sensors'
      })),
      ...availableAddresses.groups.map(g => ({ 
        value: g.address, 
        label: g.name,
        group: 'Groups'
      })),
      ...availableAddresses.lights.map(l => ({ 
        value: l.address, 
        label: l.name,
        group: 'Lights'
      }))
    ];

    return options;
  };

  const addressOptions = getAddressOptions();

  return (
    <Modal open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModalContent size="xl">
      <div className="p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-6">
          {editRule ? 'Edit Automation Rule' : 'Create Automation Rule'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Templates Section */}
          {!editRule && templates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Quick Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {templates.map(template => (
                    <Button
                      key={template.id}
                      type="button"
                      variant={selectedTemplate === template.id ? "default" : "outline"}
                      onClick={() => applyTemplate(template.id)}
                      className="h-auto p-3 flex flex-col gap-2 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{template.icon}</span>
                        <span className="font-medium text-sm">{template.name}</span>
                      </div>
                      <span className="text-xs opacity-75">{template.description}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="font-medium text-red-800">Validation Errors</span>
              </div>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Rule Name *</label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Motion activated lights"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Turn on lights when motion detected"
              />
            </div>
          </div>

          {/* Conditions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Conditions
                <span className="text-sm font-normal text-gray-600">
                  (When these are true...)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.conditions.map((condition, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-sm">Condition {index + 1}</span>
                    {formData.conditions.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCondition(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Address</label>
                      <select
                        value={condition.address}
                        onChange={(e) => updateCondition(index, { address: e.target.value })}
                        className="w-full p-2 text-sm border border-gray-300 rounded-md"
                        required
                      >
                        <option value="">Select address...</option>
                        {addressOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">Operator</label>
                      <select
                        value={condition.operator}
                        onChange={(e) => updateCondition(index, { operator: e.target.value as any })}
                        className="w-full p-2 text-sm border border-gray-300 rounded-md"
                        required
                      >
                        {operators.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">Value</label>
                      <Input
                        type="text"
                        value={condition.value}
                        onChange={(e) => updateCondition(index, { value: e.target.value })}
                        placeholder="true, 100, 'scene-id'"
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addCondition}
                className="w-full flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Condition
              </Button>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Actions
                <span className="text-sm font-normal text-gray-600">
                  (...do these things)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.actions.map((action, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-sm">Action {index + 1}</span>
                    {formData.actions.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAction(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Target Address</label>
                      <select
                        value={action.address}
                        onChange={(e) => updateAction(index, { address: e.target.value })}
                        className="w-full p-2 text-sm border border-gray-300 rounded-md"
                        required
                      >
                        <option value="">Select target...</option>
                        {addressOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">Method</label>
                      <select
                        value={action.method}
                        onChange={(e) => updateAction(index, { method: e.target.value as any })}
                        className="w-full p-2 text-sm border border-gray-300 rounded-md"
                        required
                      >
                        {httpMethods.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">Action Data (JSON)</label>
                    <textarea
                      value={JSON.stringify(action.body, null, 2)}
                      onChange={(e) => {
                        try {
                          const body = JSON.parse(e.target.value);
                          updateAction(index, { body });
                        } catch {
                          // Invalid JSON, don't update
                        }
                      }}
                      className="w-full p-2 text-sm border border-gray-300 rounded-md font-mono h-20"
                      placeholder='{"on": true, "bri": 200}'
                    />
                  </div>

                  {action.delay !== undefined && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium mb-1">Delay (milliseconds)</label>
                      <Input
                        type="number"
                        value={action.delay}
                        onChange={(e) => updateAction(index, { delay: parseInt(e.target.value) || 0 })}
                        placeholder="0"
                        className="text-sm"
                        min="0"
                      />
                    </div>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addAction}
                className="w-full flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Action
              </Button>
            </CardContent>
          </Card>

          {/* Rule Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Rule Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="enabled" className="text-sm font-medium">
                  Enable rule immediately
                </label>
              </div>
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
              disabled={loading || !formData.name || formData.conditions.length === 0 || formData.actions.length === 0}
            >
              {loading ? 'Saving...' : (editRule ? 'Update Rule' : 'Create Rule')}
            </Button>
          </div>
        </form>
      </div>
      </ModalContent>
    </Modal>
  );
};

export default RuleBuilder;
