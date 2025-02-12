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
      const userString = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (userString) {
        setUser(JSON.parse(userString));
      }
    } catch (error) {
      console.error('Error loading user from storage:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (newUser: User | null) => {
    try {
      if (newUser) {
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
      } else {
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
      }
      setUser(newUser);
    } catch (error) {
      console.error('Error updating user in storage:', error);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      setUser(null);
    } catch (error) {
      console.error('Error during logout:', error);
      throw error;
    }
  };

  return {
    user,
    loading,
    setUser: updateUser,
    logout,
  };
}
