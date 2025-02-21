// src/hooks/auth.ts
import {useState, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {User} from '../utils/db_types';

const USER_STORAGE_KEY = '@user_data';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserFromStorage();
  }, []);

  const loadUserFromStorage = async () => {
    try {
      setLoading(true);
      const userString = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (userString) {
        const parsedUser = JSON.parse(userString);
        console.log('Usuario cargado del storage:', parsedUser);
        setUser(parsedUser);
      }
    } catch (error) {
      console.error('Error cargando usuario del storage:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (newUser: User | null) => {
    try {
      console.log('Actualizando usuario:', newUser);
      if (newUser) {
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
        setUser(newUser);
      } else {
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
        setUser(null);
      }
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      setUser(null);
    } catch (error) {
      console.error('Error durante logout:', error);
      throw error;
    }
  };

  return {
    user,
    loading,
    updateUser,
    logout,
  };
}
