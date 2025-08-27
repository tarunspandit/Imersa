import React, { useState } from 'react';
import { Schedule } from '@/types';
import { Button, Switch } from '@/components/ui';
import { Play, Edit2, Trash2, Clock, Calendar, AlertTriangle } from 'lucide-react';

interface ScheduleRowProps {
  schedule: Schedule;
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, enabled: boolean) => void;
  onTrigger: (id: string) => void;
  conflicts?: string[];
}

const ScheduleRow: React.FC<ScheduleRowProps> = ({
  schedule,
  onEdit,
  onDelete,
  onToggleStatus,
  onTrigger,
  conflicts = []
}) => {
  const [loading, setLoading] = useState(false);
  const hasConflict = conflicts.includes(schedule.id);

  const handleToggleStatus = async () => {
    setLoading(true);
    try {
      await onToggleStatus(schedule.id, schedule.status !== 'enabled');
    } finally {
      setLoading(false);
    }
  };

  const handleTrigger = async () => {
    setLoading(true);
    try {
      await onTrigger(schedule.id);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time?: string, localtime?: string) => {
    if (time) return time;
    if (localtime) {
      // Handle various localtime formats
      if (localtime.includes('T')) {
        const timePart = localtime.split('T')[1];
        if (timePart) {
          return timePart.substring(0, 5); // HH:MM
        }
      }
      return localtime;
    }
    return '--:--';
  };

  const getScheduleType = () => {
    if (schedule.localtime?.includes('W')) return 'Weekly';
    if (schedule.localtime?.startsWith('PT')) return 'Timer';
    if (schedule.localtime?.startsWith('R')) return 'Recurring';
    if (schedule.type) {
      return schedule.type.charAt(0).toUpperCase() + schedule.type.slice(1);
    }
    return 'One-time';
  };

  const getStatusColor = () => {
    if (hasConflict) return 'text-red-600';
    if (schedule.status === 'enabled') return 'text-green-600';
    return 'text-gray-500';
  };

  const getStatusBadge = () => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    
    if (hasConflict) {
      return `${baseClasses} bg-red-100 text-red-800`;
    }
    
    if (schedule.status === 'enabled') {
      return `${baseClasses} bg-green-100 text-green-800`;
    }
    
    return `${baseClasses} bg-gray-100 text-gray-800`;
  };

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-4 px-6">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{schedule.name}</span>
          {hasConflict && (
            <span title="Schedule has conflicts">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </span>
          )}
        </div>
        {schedule.description && (
          <p className="text-sm text-gray-600 mt-1">{schedule.description}</p>
        )}
      </td>
      
      <td className="py-4 px-6">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400" />
          <span className="font-mono text-sm">
            {formatTime(schedule.time, schedule.localtime)}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <Calendar className="h-3 w-3 text-gray-400" />
          <span className="text-xs text-gray-600">{getScheduleType()}</span>
        </div>
      </td>
      
      <td className="py-4 px-6">
        <div className="flex items-center gap-2">
          <span className={getStatusBadge()}>
            {hasConflict ? 'Conflict' : (schedule.status === 'enabled' ? 'Active' : 'Inactive')}
          </span>
        </div>
        {schedule.nextRun && (
          <p className="text-xs text-gray-600 mt-1">
            Next: {new Date(schedule.nextRun).toLocaleString()}
          </p>
        )}
      </td>
      
      <td className="py-4 px-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={schedule.status === 'enabled'}
            onCheckedChange={() => handleToggleStatus()}
            disabled={loading}
            className="mr-2"
          />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTrigger}
            disabled={loading}
            className="p-1"
            title="Trigger now"
          >
            <Play className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(schedule)}
            className="p-1"
            title="Edit schedule"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(schedule.id)}
            disabled={loading}
            className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Delete schedule"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
};

export default ScheduleRow;
