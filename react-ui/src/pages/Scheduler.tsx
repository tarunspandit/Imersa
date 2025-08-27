import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { useSchedules } from '@/hooks/useSchedules';
import { Schedule, CreateScheduleRequest } from '@/types';
import ScheduleRow from '@/components/schedules/ScheduleRow';
import CreateScheduleModal from '@/components/schedules/CreateScheduleModal';
import { 
  Plus, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Activity,
  TrendingUp,
  Pause,
  Play
} from 'lucide-react';

const Scheduler: React.FC = () => {
  const {
    schedules,
    loading,
    error,
    stats,
    templates,
    conflicts,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    enableSchedule,
    disableSchedule,
    triggerSchedule,
    bulkUpdateSchedules,
    bulkDeleteSchedules,
    refresh
  } = useSchedules();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([]);
  const [showConflicts, setShowConflicts] = useState(true);

  const handleCreateSchedule = async (scheduleData: CreateScheduleRequest): Promise<boolean> => {
    const success = await createSchedule(scheduleData);
    if (success) {
      setIsCreateModalOpen(false);
      return true;
    }
    return false;
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setEditSchedule(schedule);
    setIsCreateModalOpen(true);
  };

  const handleDeleteSchedule = async (id: string) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      await deleteSchedule(id);
    }
  };

  const handleToggleScheduleStatus = async (id: string, enabled: boolean) => {
    if (enabled) {
      await enableSchedule(id);
    } else {
      await disableSchedule(id);
    }
  };

  const handleTriggerSchedule = async (id: string) => {
    await triggerSchedule(id);
  };

  const handleBulkAction = async (action: 'enable' | 'disable' | 'delete') => {
    if (selectedSchedules.length === 0) return;

    if (action === 'delete' && !confirm(`Delete ${selectedSchedules.length} schedules?`)) {
      return;
    }

    if (action === 'enable') {
      await bulkUpdateSchedules(selectedSchedules, { status: 'enabled' });
    } else if (action === 'disable') {
      await bulkUpdateSchedules(selectedSchedules, { status: 'disabled' });
    } else if (action === 'delete') {
      await bulkDeleteSchedules(selectedSchedules);
    }

    setSelectedSchedules([]);
  };

  const toggleScheduleSelection = (scheduleId: string) => {
    setSelectedSchedules(prev =>
      prev.includes(scheduleId)
        ? prev.filter(id => id !== scheduleId)
        : [...prev, scheduleId]
    );
  };

  const selectAllSchedules = () => {
    const allIds = Object.keys(schedules);
    setSelectedSchedules(selectedSchedules.length === allIds.length ? [] : allIds);
  };

  const schedulesArray = Object.values(schedules);
  const conflictedScheduleIds = conflicts.flatMap(c => c.scheduleIds);

  if (loading && schedulesArray.length === 0) {
    return (
      <div className="p-6 space-y-6 pb-20">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 pb-20">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Scheduler</h1>
          <p className="text-muted-foreground mt-1">
            Manage lighting schedules and automation timing
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Schedule
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
              <Calendar className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Schedules</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Activity className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Conflicts</p>
                <p className="text-2xl font-bold">{conflicts.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Conflicts Alert */}
      {conflicts.length > 0 && showConflicts && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <h3 className="font-semibold text-red-800">Schedule Conflicts Detected</h3>
                  <p className="text-red-700 text-sm mt-1">
                    {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} found that may affect scheduling
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowConflicts(false)}
                className="text-red-600 hover:text-red-700"
              >
                Dismiss
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {conflicts.map((conflict, index) => (
                <div key={index} className="text-sm text-red-700 bg-red-100 p-2 rounded">
                  <strong>{conflict.conflictType.replace('_', ' ')}:</strong> {conflict.description}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions */}
      {selectedSchedules.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-blue-800">
                {selectedSchedules.length} schedule{selectedSchedules.length > 1 ? 's' : ''} selected
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

      {/* Schedules Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Schedules ({schedulesArray.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={selectAllSchedules}
              >
                {selectedSchedules.length === Object.keys(schedules).length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={refresh}
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {schedulesArray.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first schedule to automate your lighting system
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Schedule
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium">
                      <input
                        type="checkbox"
                        checked={selectedSchedules.length === schedulesArray.length}
                        onChange={selectAllSchedules}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-medium">Schedule</th>
                    <th className="text-left py-3 px-4 font-medium">Time</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedulesArray.map((schedule) => (
                    <tr key={schedule.id}>
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          checked={selectedSchedules.includes(schedule.id)}
                          onChange={() => toggleScheduleSelection(schedule.id)}
                          className="rounded"
                        />
                      </td>
                      <ScheduleRow
                        schedule={schedule}
                        onEdit={handleEditSchedule}
                        onDelete={handleDeleteSchedule}
                        onToggleStatus={handleToggleScheduleStatus}
                        onTrigger={handleTriggerSchedule}
                        conflicts={conflictedScheduleIds}
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Schedule Modal */}
      <CreateScheduleModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditSchedule(null);
        }}
        onSubmit={handleCreateSchedule}
        templates={templates}
        editSchedule={editSchedule}
      />
    </div>
  );
};

export default Scheduler;