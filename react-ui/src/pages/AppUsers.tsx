import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { Wizard } from '@/components/ui/Wizard';
import axios from 'axios';
import authService from '@/services/authApi';
import { 
  Users, Key, Shield, Trash2, RefreshCw, 
  Calendar, Activity, Loader2, AlertTriangle, Plus
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AppUser {
  id: string;
  name: string;
  'create date': string;
  'last use date': string;
  permissions?: string[];
}

const AppUsers: React.FC = () => {
  const [users, setUsers] = useState<Record<string, AppUser>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showLinkButton, setShowLinkButton] = useState(false);
  const [linkButtonActive, setLinkButtonActive] = useState(false);
  const [linkButtonTimer, setLinkButtonTimer] = useState(0);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (linkButtonTimer > 0) {
      const timer = setTimeout(() => {
        setLinkButtonTimer(linkButtonTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (linkButtonActive) {
      setLinkButtonActive(false);
      toast('Link button timeout');
    }
  }, [linkButtonTimer, linkButtonActive]);

  const fetchUsers = async () => {
    try {
      const apiKey = authService.getStoredApiKey();
      const response = await axios.get(`/api/${apiKey}/config`);
      const whitelist = response.data.whitelist || {};
      setUsers(whitelist);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load app users');
      setIsLoading(false);
    }
  };

  const handleActivateLinkButton = async () => {
    try {
      const apiKey = authService.getStoredApiKey();
      await axios.put(`/api/${apiKey}/config`, { linkbutton: true });
      setLinkButtonActive(true);
      setLinkButtonTimer(30);
      toast.success('Link button activated for 30 seconds');
    } catch (error) {
      toast.error('Failed to activate link button');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm(`Are you sure you want to delete user "${users[userId]?.name}"?`)) return;

    try {
      const apiKey = authService.getStoredApiKey();
      await axios.delete(`/api/${apiKey}/config/whitelist/${userId}`);
      toast.success('User deleted successfully');
      await fetchUsers();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getLastUseDays = (dateString: string) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Yesterday';
      return `${diff} days ago`;
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="p-6 space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">App Users</h1>
          <p className="text-muted-foreground mt-1">
            Manage applications connected to your bridge
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchUsers} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowLinkButton(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Link New App
          </Button>
        </div>
      </div>

      {/* Link Button Status */}
      {linkButtonActive && (
        <Card className="border-green-500 bg-green-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="font-medium">Link button is active</span>
                <span className="text-sm text-muted-foreground">
                  Press the connect button in your app now
                </span>
              </div>
              <span className="text-2xl font-mono">{linkButtonTimer}s</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : Object.keys(users).length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">No app users found</p>
            <p className="text-muted-foreground mt-1">
              Click "Link New App" to connect an application
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(users).map(([id, user]) => (
            <Card key={id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{user.name}</CardTitle>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {id.substring(0, 16)}...
                    </p>
                  </div>
                  <Key className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Created:
                    </span>
                    <span className="text-xs">
                      {formatDate(user['create date'])}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      Last used:
                    </span>
                    <span className="text-xs">
                      {getLastUseDays(user['last use date'])}
                    </span>
                  </div>
                </div>
                
                <div className="pt-3 border-t flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSelectedUser(id)}
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    Details
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => handleDeleteUser(id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Link Button Wizard */}
      <Wizard
        isOpen={showLinkButton}
        onClose={() => setShowLinkButton(false)}
        title="Link New Application"
      >
        <div className="space-y-4">
          <p>
            The link button allows new applications to connect to your bridge. 
            Once activated, you have 30 seconds to press the connect button in your app.
          </p>
          
          <div className="p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg">
            <p className="text-sm font-medium mb-2">Compatible Apps:</p>
            <ul className="text-sm space-y-1">
              <li>• Philips Hue official app</li>
              <li>• Hue Essentials</li>
              <li>• iConnectHue</li>
              <li>• Hue Disco</li>
              <li>• Any third-party Hue app</li>
            </ul>
          </div>

          <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Security Note:</p>
                <p>Anyone on your local network can connect during this time. 
                   Only activate when you're ready to connect a new app.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowLinkButton(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                handleActivateLinkButton();
                setShowLinkButton(false);
              }}
            >
              Activate Link Button
            </Button>
          </div>
        </div>
      </Wizard>

      {/* User Details Modal */}
      {selectedUser && users[selectedUser] && (
        <Wizard
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          title="User Details"
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Application Name</label>
              <p className="text-lg">{users[selectedUser].name}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium">API Key</label>
              <p className="font-mono text-xs p-2 bg-muted rounded break-all">
                {selectedUser}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Created</label>
                <p className="text-sm">{formatDate(users[selectedUser]['create date'])}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Last Used</label>
                <p className="text-sm">{formatDate(users[selectedUser]['last use date'])}</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setSelectedUser(null)}>
                Close
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  handleDeleteUser(selectedUser);
                  setSelectedUser(null);
                }}
              >
                Delete User
              </Button>
            </div>
          </div>
        </Wizard>
      )}
    </div>
  );
};

export default AppUsers;