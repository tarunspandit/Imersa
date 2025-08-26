import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme, Language, AppSettings, NotificationItem } from '@/types';

interface AppState {
  // Theme and appearance
  theme: Theme;
  language: Language;
  sidebarCollapsed: boolean;
  compactMode: boolean;
  
  // Settings
  settings: AppSettings;
  
  // Notifications
  notifications: NotificationItem[];
  unreadCount: number;
  
  // UI state
  isLoading: boolean;
  globalError: string | null;
  modals: {
    settingsOpen: boolean;
    profileOpen: boolean;
    helpOpen: boolean;
  };
  
  // Actions
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleCompactMode: () => void;
  
  // Settings actions
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  
  // Notification actions
  addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  
  // UI actions
  setLoading: (loading: boolean) => void;
  setGlobalError: (error: string | null) => void;
  openModal: (modal: keyof AppState['modals']) => void;
  closeModal: (modal: keyof AppState['modals']) => void;
  closeAllModals: () => void;
}

const defaultSettings: AppSettings = {
  theme: 'system',
  language: 'en',
  autoDiscovery: true,
  pollingInterval: 5000,
  maxRetries: 3,
  timeout: 10000,
  debug: false,
  features: {
    entertainment: true,
    scheduling: true,
    gradients: true,
    musicSync: false,
    voiceControl: false,
    geofencing: false,
  },
};

const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      theme: 'system',
      language: 'en',
      sidebarCollapsed: false,
      compactMode: false,
      settings: defaultSettings,
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      globalError: null,
      modals: {
        settingsOpen: false,
        profileOpen: false,
        helpOpen: false,
      },

      // Theme and appearance actions
      setTheme: (theme: Theme) => {
        set({ theme });
        
        // Apply theme to document
        const root = document.documentElement;
        if (theme === 'dark') {
          root.classList.add('dark');
        } else if (theme === 'light') {
          root.classList.remove('dark');
        } else {
          // System theme
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (prefersDark) {
            root.classList.add('dark');
          } else {
            root.classList.remove('dark');
          }
        }
      },

      setLanguage: (language: Language) => {
        set({ language });
        // Here you would integrate with i18n library
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set({ sidebarCollapsed: collapsed });
      },

      toggleCompactMode: () => {
        set((state) => ({ compactMode: !state.compactMode }));
      },

      // Settings actions
      updateSettings: (newSettings: Partial<AppSettings>) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
        
        // Apply theme if it changed
        if (newSettings.theme) {
          get().setTheme(newSettings.theme);
        }
      },

      resetSettings: () => {
        set({ settings: defaultSettings });
        get().setTheme(defaultSettings.theme);
      },

      // Notification actions
      addNotification: (notification) => {
        const id = Math.random().toString(36).substring(2);
        const newNotification: NotificationItem = {
          ...notification,
          id,
          timestamp: new Date().toISOString(),
          read: false,
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications].slice(0, 50), // Keep only last 50
          unreadCount: state.unreadCount + 1,
        }));
      },

      markNotificationRead: (id: string) => {
        set((state) => {
          const notification = state.notifications.find((n) => n.id === id);
          if (!notification || notification.read) return state;

          return {
            notifications: state.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          };
        });
      },

      markAllNotificationsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },

      removeNotification: (id: string) => {
        set((state) => {
          const notification = state.notifications.find((n) => n.id === id);
          const unreadCountDelta = notification && !notification.read ? -1 : 0;

          return {
            notifications: state.notifications.filter((n) => n.id !== id),
            unreadCount: Math.max(0, state.unreadCount + unreadCountDelta),
          };
        });
      },

      clearAllNotifications: () => {
        set({ notifications: [], unreadCount: 0 });
      },

      // UI actions
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setGlobalError: (error: string | null) => {
        set({ globalError: error });
      },

      openModal: (modal: keyof AppState['modals']) => {
        set((state) => ({
          modals: { ...state.modals, [modal]: true },
        }));
      },

      closeModal: (modal: keyof AppState['modals']) => {
        set((state) => ({
          modals: { ...state.modals, [modal]: false },
        }));
      },

      closeAllModals: () => {
        set({
          modals: {
            settingsOpen: false,
            profileOpen: false,
            helpOpen: false,
          },
        });
      },
    }),
    {
      name: 'imersa-app',
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        sidebarCollapsed: state.sidebarCollapsed,
        compactMode: state.compactMode,
        settings: state.settings,
      }),
    }
  )
);

// Initialize theme on store creation
const initializeTheme = () => {
  const { theme, setTheme } = useAppStore.getState();
  setTheme(theme);
};

// Listen for system theme changes
if (typeof window !== 'undefined') {
  initializeTheme();
  
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const { theme, setTheme } = useAppStore.getState();
    if (theme === 'system') {
      setTheme('system'); // Re-apply system theme
    }
  });
}

export { useAppStore };