// src/contexts/AuthContext.tsx
import React, {createContext, useContext, useEffect, useState} from 'react';
import {Alert} from 'react-native';
import {useAuth} from '../hooks/auth';
//import NotificationService from '../services/notifications';
import {authService} from '../services/api';

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (phoneNumber: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const auth = useAuth(); // Obtener todo el objeto auth
  const [notificationServiceActive, setNotificationServiceActive] =
    useState(false);

  // Desestructurar los valores que necesitamos
  const {user, loading, updateUser, logout: authLogout} = auth;

  // Verificar que updateUser existe
  if (!updateUser) {
    console.error('updateUser no está definido en useAuth');
  }

  // Iniciar servicio de notificaciones cuando el usuario es un chofer
  useEffect(() => {
    if (user?.role === 'chofer' && user?.driver_profiles?.id) {
      console.log(
        'Iniciando servicio de notificaciones para chofer:',
        user.driver_profiles.id,
      );
      // NotificationService.startNotificationService(user.driver_profiles.id);
    }

    return () => {
      if (user?.role === 'chofer') {
        console.log('Deteniendo servicio de notificaciones');
        // NotificationService.stopNotificationService();
      }
    };
  }, [user]);

  const login = async (phoneNumber: string, pin: string) => {
    try {
      console.log('Iniciando login...');
      const userData = await authService.login(phoneNumber, pin);

      if (!updateUser) {
        throw new Error('updateUser no está disponible');
      }

      // Verificar si es un chofer y está activo
      if (userData.role === 'chofer' && !userData.active) {
        throw new Error('Cuenta de chofer inactiva');
      }

      console.log('Actualizando usuario con:', userData);
      await updateUser(userData);
      console.log('Usuario actualizado exitosamente');
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Detener el servicio de notificaciones antes de cerrar sesión
      if (user?.role === 'chofer') {
        // await NotificationService.stopNotificationService();
      }
      await authLogout();
    } catch (error) {
      console.error('Error en logout:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext debe ser usado dentro de un AuthProvider');
  }
  return context;
};
