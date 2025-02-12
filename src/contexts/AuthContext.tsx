// src/contexts/AuthContext.tsx
import React, {createContext, useContext} from 'react';
import {useAuth} from '../hooks/auth';
import {User} from '../utils/db_types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({children}: {children: React.ReactNode}) {
  const auth = useAuth();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
