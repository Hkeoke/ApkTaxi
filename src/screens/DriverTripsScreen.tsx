import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import {tripService} from '../services/api';
import {Clock, Ban, CheckCircle, AlertCircle} from 'lucide-react-native';

interface Trip {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  price: number;
  origin: string;
  destination: string;
  commission?: number;
  created_at: string;
}

const DriverTripsScreen = ({user}: {user: {id: string}}) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('completed');

  const loadTrips = async () => {
    try {
      setLoading(true);
      if (!user?.id) {
        console.log('No user ID available');
        return;
      }
      const driverTrips = await tripService.getDriverTrips(user.id);
      setTrips(driverTrips);
    } catch (error) {
      console.error('Error cargando viajes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadTrips();
    }
  }, [user?.id]);

  const getStatusColor = (status: string) => {
    const colors = {
      pending: '#f59e0b',
      in_progress: '#3b82f6',
      completed: '#10b981',
      cancelled: '#ef4444',
    };
    return colors[status as keyof typeof colors] || '#6b7280';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock size={20} color={getStatusColor(status)} />;
      case 'in_progress':
        return <AlertCircle size={20} color={getStatusColor(status)} />;
      case 'completed':
        return <CheckCircle size={20} color={getStatusColor(status)} />;
      case 'cancelled':
        return <Ban size={20} color={getStatusColor(status)} />;
      default:
        return null;
    }
  };

  const renderTripItem = ({item}: {item: Trip}) => {
    const commission = item.price * 0.1; // Calculamos el 10% del precio

    return (
      <View style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <View style={styles.statusContainer}>
            {getStatusIcon(item.status)}
            <Text
              style={[styles.statusText, {color: getStatusColor(item.status)}]}>
              {item.status === 'completed' ? 'Completado' : 'Cancelado'}
            </Text>
          </View>
          <Text style={styles.date}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.tripDetails}>
          <Text style={styles.locationText}>
            <Text style={styles.locationLabel}>Origen: </Text>
            {item.origin}
          </Text>
          <Text style={styles.locationText}>
            <Text style={styles.locationLabel}>Destino: </Text>
            {item.destination}
          </Text>
        </View>

        {item.status === 'completed' && (
          <View style={styles.priceContainer}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Precio del viaje:</Text>
              <Text style={styles.priceValue}>${item.price.toFixed(2)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.commissionLabel}>Comisión (10%):</Text>
              <Text style={styles.commissionValue}>
                -${commission.toFixed(2)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total recibido:</Text>
              <Text style={styles.totalValue}>
                ${(item.price - commission).toFixed(2)}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const filteredTrips = trips.filter(trip => trip.status === activeTab);

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'completed' && styles.activeTabText,
            ]}>
            Completados
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'cancelled' && styles.activeTab]}
          onPress={() => setActiveTab('cancelled')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'cancelled' && styles.activeTabText,
            ]}>
            Cancelados
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#dc2626" />
      ) : (
        <FlatList
          data={filteredTrips}
          renderItem={renderTripItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay viajes para mostrar</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#dc2626',
  },
  tabText: {
    color: '#fecaca',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#dc2626',
  },
  listContainer: {
    padding: 10,
  },
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  date: {
    fontSize: 14,
    color: '#6b7280',
  },
  tripDetails: {
    gap: 5,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
  },
  locationLabel: {
    fontWeight: '500',
    color: '#6b7280',
  },
  priceContainer: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  priceLabel: {
    color: '#374151',
    fontSize: 14,
  },
  priceValue: {
    color: '#059669',
    fontWeight: '600',
    fontSize: 14,
  },
  commissionLabel: {
    color: '#374151',
    fontSize: 14,
  },
  commissionValue: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 14,
  },
  totalLabel: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  },
  totalValue: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 14,
  },
  loader: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 20,
  },
});

export default DriverTripsScreen;
