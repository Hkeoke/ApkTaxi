import {useState, useEffect} from 'react';
import supabase from '../utils/supabase';
import {User} from '../utils/database';

export function useAuth() {
  const [user, setUser] = (useState < User) | (null > null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Aquí podrías implementar la lógica de persistencia de sesión
    // Por ejemplo, recuperando datos del AsyncStorage
    setLoading(false);
  }, []);

  return {
    user,
    loading,
    setUser,
  };
}
