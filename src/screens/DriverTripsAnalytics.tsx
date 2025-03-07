import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {TrendingUp, DollarSign, Wallet} from 'lucide-react-native';
import {analyticsService} from '../services/api';

interface TripStats {
  totalTrips: number;
  totalEarnings: number;
  balance: number;
}

const DriverTripsAnalytics = ({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) => {
  const driverId = route.params?.driverId;
  const [timeFrame, setTimeFrame] = useState<'day' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TripStats | null>(null);

  useEffect(() => {
    if (!driverId) {
      Alert.alert('Error', 'No se especificó un chofer');
      navigation.goBack();
      return;
    }
    fetchStats();
  }, [timeFrame, driverId]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      console.log('Iniciando fetchStats para conductor:', driverId);

      const data = await analyticsService.getDriverTripStats(
        driverId,
        timeFrame,
      );
      console.log('Datos recibidos en componente:', data);

      if (!data) {
        console.log('No se recibieron datos');
        Alert.alert('Error', 'No se pudieron obtener las estadísticas');
        return;
      }

      setStats(data);
    } catch (error) {
      console.error('Error en fetchStats:', error);
      Alert.alert(
        'Error',
        'No se pudieron obtener las estadísticas del conductor. Por favor, intente de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({
    icon,
    title,
    value,
    subtitle,
  }: {
    icon: React.ReactNode;
    title: string;
    value: string | number;
    subtitle?: string;
  }) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={styles.iconContainer}>{icon}</View>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Estadísticas de Viajes</Text>
        <View style={styles.timeFrameContainer}>
          <TouchableOpacity
            style={[
              styles.timeFrameButton,
              timeFrame === 'day' && styles.timeFrameSelected,
            ]}
            onPress={() => setTimeFrame('day')}>
            <Text
              style={[
                styles.timeFrameText,
                timeFrame === 'day' && styles.timeFrameTextSelected,
              ]}>
              Hoy
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.timeFrameButton,
              timeFrame === 'week' && styles.timeFrameSelected,
            ]}
            onPress={() => setTimeFrame('week')}>
            <Text
              style={[
                styles.timeFrameText,
                timeFrame === 'week' && styles.timeFrameTextSelected,
              ]}>
              Semana
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.timeFrameButton,
              timeFrame === 'month' && styles.timeFrameSelected,
            ]}
            onPress={() => setTimeFrame('month')}>
            <Text
              style={[
                styles.timeFrameText,
                timeFrame === 'month' && styles.timeFrameTextSelected,
              ]}>
              Mes
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <StatCard
          icon={<TrendingUp size={24} color="#dc2626" />}
          title="Total Viajes"
          value={stats?.totalTrips || 0}
          subtitle="viajes completados"
        />
        <StatCard
          icon={<DollarSign size={24} color="#dc2626" />}
          title="Ganancias Totales"
          value={`$${stats?.totalEarnings?.toFixed(2) || '0.00'}`}
          subtitle="ingresos del período"
        />
        <StatCard
          icon={<Wallet size={24} color="#dc2626" />}
          title="Balance Actual"
          value={`$${stats?.balance?.toFixed(2) || '0.00'}`}
          subtitle="disponible"
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  timeFrameContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  timeFrameButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#fef2f2',
  },
  timeFrameSelected: {
    backgroundColor: '#dc2626',
  },
  timeFrameText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  timeFrameTextSelected: {
    color: '#ffffff',
  },
  statsContainer: {
    padding: 16,
    gap: 16,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    marginRight: 8,
  },
  statTitle: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
});

export default DriverTripsAnalytics;
