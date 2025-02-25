import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {tripService, tripRequestService} from '../services/api';
import {Clock, Ban, CheckCircle, AlertCircle} from 'lucide-react-native';

interface TripOrRequest {
  id: string;
  type: 'trip' | 'request';
  status:
    | 'broadcasting'
    | 'pending'
    | 'in_progress'
    | 'completed'
    | 'cancelled';
  price: number;
  origin: string;
  destination: string;
  created_at: string;
}

const OperatorTripsScreen = ({user}: {user: {id: string}}) => {
  const [items, setItems] = useState<TripOrRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  const loadTrips = async () => {
    try {
      setLoading(true);
      const operatorTrips = await tripService.getOperatorTrips(user.id);
      setItems(operatorTrips);
    } catch (error) {
      console.error('Error cargando viajes:', error);
      Alert.alert('Error', 'No se pudieron cargar los viajes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrips();
    // Actualizar cada 30 segundos
    const interval = setInterval(loadTrips, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCancelTrip = async (item: TripOrRequest) => {
    Alert.alert(
      'Confirmar Cancelación',
      '¿Estás seguro de que deseas cancelar este viaje?',
      [
        {text: 'No', style: 'cancel'},
        {
          text: 'Sí',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.type === 'request') {
                await tripRequestService.updateRequestStatus(
                  item.id,
                  'rejected',
                );
              } else {
                await tripService.updateTripStatus(item.id, 'cancelled');
              }
              loadTrips();
              Alert.alert('Éxito', 'Viaje cancelado correctamente');
            } catch (error) {
              console.error('Error cancelando viaje:', error);
              Alert.alert('Error', 'No se pudo cancelar el viaje');
            }
          },
        },
      ],
    );
  };

  const getStatusColor = (status: string) => {
    const colors = {
      broadcasting: '#8b5cf6', // Morado para solicitudes en broadcasting
      pending: '#f59e0b',
      in_progress: '#3b82f6',
      completed: '#10b981',
      cancelled: '#ef4444',
    };
    return colors[status as keyof typeof colors] || '#6b7280';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'broadcasting':
        return <AlertCircle size={20} color={getStatusColor(status)} />;
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

  const renderTripItem = ({item}: {item: TripOrRequest}) => {
    const canCancel = ['broadcasting', 'pending', 'in_progress'].includes(
      item.status,
    );

    return (
      <View style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <View style={styles.statusContainer}>
            {getStatusIcon(item.status)}
            <Text
              style={[styles.statusText, {color: getStatusColor(item.status)}]}>
              {item.status === 'broadcasting'
                ? 'Buscando Chofer'
                : item.status === 'pending'
                ? 'Pendiente'
                : item.status === 'in_progress'
                ? 'En Progreso'
                : item.status === 'completed'
                ? 'Completado'
                : 'Cancelado'}
            </Text>
          </View>
          <Text style={styles.price}>${item.price}</Text>
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

        {canCancel && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => handleCancelTrip(item)}>
            <Text style={styles.cancelButtonText}>Cancelar Viaje</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const filteredItems = items.filter(item => {
    if (activeTab === 'active') {
      return ['broadcasting', 'pending', 'in_progress'].includes(item.status);
    }
    return item.status === activeTab;
  });

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'active' && styles.activeTabText,
            ]}>
            Activos
          </Text>
        </TouchableOpacity>
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
        <ActivityIndicator style={styles.loader} size="large" color="#0891b2" />
      ) : (
        <FlatList
          data={filteredItems}
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
    borderBottomColor: '#0891b2',
  },
  tabText: {
    color: '#6b7280',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#0891b2',
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
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  tripDetails: {
    gap: 5,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
  },
  locationLabel: {
    fontWeight: '500',
    color: '#6b7280',
  },
  cancelButton: {
    backgroundColor: '#ef4444',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 20,
  },
});

export default OperatorTripsScreen;
