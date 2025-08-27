import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // Validate against original DIYHue credentials
          if (email === 'admin@diyhue.org' && password === 'changeme') {
            const user: User = {
              id: '1',
              name: 'DIYHue Admin',
              email: 'admin@diyhue.org',
              role: 'admin',
              createdAt: new Date().toISOString(),
              preferences: {
                theme: 'system',
                language: 'en',
                notifications: { email: true, push: false, system: true },
                dashboard: { compactMode: false, showGrid: true, autoRefresh: true },
              },
            };
            
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error('Invalid credentials');
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false,
          });
        }
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      register: async (email: string, password: string, name: string) => {
        // Registration not needed for bridge emulator
        return;
      },

      updateProfile: async (updates: Partial<User>) => {
        const { user } = get();
        if (!user) return;

        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(`/api/users/${user.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });

          if (!response.ok) {
            throw new Error('Profile update failed');
          }

          const updatedUser = await response.json();
          
          set({
            user: { ...user, ...updatedUser },
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Profile update failed',
            isLoading: false,
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      checkAuth: async () => {
        // Check if user is persisted from previous session
        const { user, isAuthenticated } = get();
        if (isAuthenticated && user) {
          set({
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: 'imersa-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export { useAuthStore };
