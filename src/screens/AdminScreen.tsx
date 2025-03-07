// src/screens/AdminScreen.js
import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {Text} from 'react-native';
import {useAuthContext} from '../contexts/AuthContext';
import {
  Users,
  Truck,
  LogOut,
  ChevronRight,
  Menu,
  RefreshCw,
} from 'lucide-react-native';
import Sidebar from '../components/Sidebar';
import {analyticsService} from '../services/api';

interface DashboardStats {
  tripsToday: number;
  activeDrivers: number;
  totalUsers: number;
}

const AdminScreen = ({navigation}: {navigation: any}) => {
  const {logout, user} = useAuthContext();
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => setIsSidebarVisible(true)}
          style={{marginLeft: 15}}>
          <Menu color="#dc2626" size={24} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={handleRefresh}
          style={{marginRight: 15}}
          disabled={refreshing}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#dc2626" />
          ) : (
            <RefreshCw color="#dc2626" size={24} />
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, refreshing]);

  const fetchStats = async () => {
    try {
      const dashboardStats = await analyticsService.getAdminDashboardStats();
      setStats(dashboardStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Panel de Administración</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gestión de Usuarios</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('DriverManagementScreen')}>
            <View style={styles.menuItemContent}>
              <Users size={24} color="#dc2626" />
              <Text style={styles.menuItemText}>Gestionar Choferes</Text>
            </View>
            <ChevronRight size={20} color="#dc2626" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('OperatorManagementScreen')}>
            <View style={styles.menuItemContent}>
              <Users size={24} color="#dc2626" />
              <Text style={styles.menuItemText}>Gestionar Operadores</Text>
            </View>
            <ChevronRight size={20} color="#dc2626" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estadísticas</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats?.tripsToday || 0}</Text>
              <Text style={styles.statLabel}>Viajes Hoy</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats?.activeDrivers || 0}</Text>
              <Text style={styles.statLabel}>Choferes Activos</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats?.totalUsers || 0}</Text>
              <Text style={styles.statLabel}>Total Usuarios</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={24} color="#ef4444" />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setIsSidebarVisible(false)}
        role="admin"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dc2626',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#334155',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AdminScreen;
