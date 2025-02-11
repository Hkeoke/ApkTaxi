import 'react-native-url-polyfill/auto';
import {createClient} from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const url = 'https://gunevwlqmwhwsykpvfqi.supabase.co';
const key =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1bmV2d2xxbXdod3N5a3B2ZnFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyOTAwMTksImV4cCI6MjA1NDg2NjAxOX0.FR-CGD6ZUPSh5_0MKUYiUgYuKcyi96ACjwrmYFVJqoE';

const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default supabase;
