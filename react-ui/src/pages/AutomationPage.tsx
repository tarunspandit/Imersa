import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { useRules } from '@/hooks/useRules';
import { AutomationRule, CreateRuleRequest } from '@/types';
import RuleBuilder from '@/components/automation/RuleBuilder';
import { 
  Plus, 
  Zap, 
  AlertCircle, 
  Activity,
  TrendingUp,
  Pause,
  Play,
  Settings,
  Eye,
  Search
} from 'lucide-react';

const AutomationPage: React.FC = () => {
  const {
    rules,
    loading,
    error,
    stats,
    templates,
    availableAddresses,
    createRule,
    updateRule,
    deleteRule,
    enableRule,
    disableRule,
    triggerRule,
    bulkUpdateRules,
    bulkDeleteRules,
    refresh
  } = useRules();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editRule, setEditRule] = useState<AutomationRule | null>(null);
  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');

  const handleCreateRule = async (ruleData: CreateRuleRequest): Promise<boolean> => {
    const success = await createRule(ruleData);
    if (success) {
      setIsCreateModalOpen(false);
      return true;
    }
    return false;
  };

  const handleEditRule = (rule: AutomationRule) => {
    setEditRule(rule);
    setIsCreateModalOpen(true);
  };

  const handleDeleteRule = async (id: string) => {
    if (confirm('Are you sure you want to delete this automation rule?')) {
      await deleteRule(id);
    }
  };

  const handleToggleRuleStatus = async (id: string, enabled: boolean) => {
    if (enabled) {
      await enableRule(id);
    } else {
      await disableRule(id);
    }
  };

  const handleTriggerRule = async (id: string) => {
    await triggerRule(id);
  };

  const handleBulkAction = async (action: 'enable' | 'disable' | 'delete') => {
    if (selectedRules.length === 0) return;

    if (action === 'delete' && !confirm(`Delete ${selectedRules.length} rules?`)) {
      return;
    }

    if (action === 'enable') {
      await bulkUpdateRules(selectedRules, { enabled: true });
    } else if (action === 'disable') {
      await bulkUpdateRules(selectedRules, { enabled: false });
    } else if (action === 'delete') {
      await bulkDeleteRules(selectedRules);
    }

    setSelectedRules([]);
  };

  const toggleRuleSelection = (ruleId: string) => {
    setSelectedRules(prev =>
      prev.includes(ruleId)
        ? prev.filter(id => id !== ruleId)
        : [...prev, ruleId]
    );
  };

  const selectAllRules = () => {
    const filteredRules = getFilteredRules();
    const allIds = filteredRules.map(r => r.id);
    setSelectedRules(selectedRules.length === allIds.length ? [] : allIds);
  };

  const getFilteredRules = () => {
    const rulesArray = Object.values(rules);
    
    return rulesArray.filter(rule => {
      // Filter by search term
      const matchesSearch = !searchTerm || 
        rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rule.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filter by status
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'enabled' && rule.enabled) ||
        (filterStatus === 'disabled' && !rule.enabled);
      
      return matchesSearch && matchesStatus;
    });
  };

  const filteredRules = getFilteredRules();

  if (loading && Object.keys(rules).length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Automation Rules</h1>
          <p className="text-muted-foreground mt-1">
            Create intelligent automation rules for your lighting system
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Rule
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-600">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refresh}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Zap className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Rules</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Activity className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Enabled</p>
                <p className="text-2xl font-bold">{stats.enabled}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Triggered (24h)</p>
                <p className="text-2xl font-bold">{stats.triggered24h}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">Avg Response</p>
                <p className="text-2xl font-bold">{stats.avgResponseTime}ms</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search rules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Rules</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
              <Button variant="outline" onClick={refresh}>
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedRules.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-blue-800">
                {selectedRules.length} rule{selectedRules.length > 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('enable')}
                  className="flex items-center gap-1"
                >
                  <Play className="h-3 w-3" />
                  Enable
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('disable')}
                  className="flex items-center gap-1"
                >
                  <Pause className="h-3 w-3" />
                  Disable
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('delete')}
                  className="text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Automation Rules ({filteredRules.length})
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={selectAllRules}
            >
              {selectedRules.length === filteredRules.length && filteredRules.length > 0 
                ? 'Deselect All' 
                : 'Select All'
              }
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRules.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {Object.keys(rules).length === 0 ? 'No automation rules yet' : 'No rules match your criteria'}
              </h3>
              <p className="text-gray-600 mb-4">
                {Object.keys(rules).length === 0 
                  ? 'Create your first automation rule to make your lighting system intelligent'
                  : 'Try adjusting your search or filter criteria'
                }
              </p>
              {Object.keys(rules).length === 0 && (
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Rule
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium">
                      <input
                        type="checkbox"
                        checked={selectedRules.length === filteredRules.length && filteredRules.length > 0}
                        onChange={selectAllRules}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-medium">Rule Name</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Conditions</th>
                    <th className="text-left py-3 px-4 font-medium">Actions</th>
                    <th className="text-left py-3 px-4 font-medium">Triggered</th>
                    <th className="text-left py-3 px-4 font-medium">Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.map((rule) => (
                    <tr key={rule.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          checked={selectedRules.includes(rule.id)}
                          onChange={() => toggleRuleSelection(rule.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{rule.name}</p>
                          {rule.description && (
                            <p className="text-sm text-gray-600">{rule.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          rule.enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          <p className="text-gray-600">
                            {rule.conditions.length} condition{rule.conditions.length > 1 ? 's' : ''}
                          </p>
                          {rule.conditions.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1 truncate max-w-32">
                              {rule.conditions[0].address.split('/').pop()}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          <p className="text-gray-600">
                            {rule.actions.length} action{rule.actions.length > 1 ? 's' : ''}
                          </p>
                          {rule.actions.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1 truncate max-w-32">
                              {rule.actions[0].address.split('/').pop()}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          <p className="font-medium">{rule.timesTriggered}</p>
                          {rule.lastTriggered && rule.lastTriggered !== 'none' && (
                            <p className="text-xs text-gray-500">
                              Last: {new Date(rule.lastTriggered).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleRuleStatus(rule.id, !rule.enabled)}
                            className="p-1"
                            title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                          >
                            {rule.enabled ? (
                              <Pause className="h-4 w-4 text-orange-600" />
                            ) : (
                              <Play className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTriggerRule(rule.id)}
                            className="p-1"
                            title="Test rule"
                          >
                            <Zap className="h-4 w-4 text-blue-600" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRule(rule)}
                            className="p-1"
                            title="Edit rule"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete rule"
                          >
                            <AlertCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rule Templates */}
      {templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Rule Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {templates.map((template) => (
                <div 
                  key={template.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
                  onClick={() => {
                    // TODO: Apply template to rule creation
                    setIsCreateModalOpen(true);
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{template.icon}</span>
                    <h3 className="font-medium">{template.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600">{template.description}</p>
                  <span className="inline-block mt-2 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    {template.category}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Rule Modal */}
      <RuleBuilder
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditRule(null);
        }}
        onSubmit={handleCreateRule}
        templates={templates}
        availableAddresses={availableAddresses ?? undefined}
        editRule={editRule}
      />
    </div>
  );
};

export default AutomationPage;