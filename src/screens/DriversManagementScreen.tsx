import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  User,
  MoreVertical,
  Edit,
  Trash,
  Power,
  PowerOff,
} from 'lucide-react-native';
import {driverService} from '../services/api';

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  vehicle: string;
  is_active: boolean;
  created_at: string;
}

const DriversManagementScreen = ({navigation}: {navigation: any}) => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      const response = await driverService.getAllDrivers();
      setDrivers(response);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los choferes');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (
    driverId: string,
    currentStatus: boolean,
  ) => {
    try {
      await driverService.updateDriverStatus(driverId, !currentStatus);
      fetchDrivers();
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el estado del chofer');
    }
  };

  const handleDelete = async (driverId: string) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que quieres eliminar este chofer?',
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await driverService.deleteDriver(driverId);
              fetchDrivers();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar el chofer');
            }
          },
        },
      ],
    );
  };

  const renderDriver = ({item}: {item: Driver}) => (
    <View style={styles.driverCard}>
      <View style={styles.driverInfo}>
        <View
          style={[
            styles.statusIndicator,
            {backgroundColor: item.is_active ? '#22c55e' : '#ef4444'},
          ]}
        />
        <View style={styles.driverDetails}>
          <Text style={styles.driverName}>
            {item.first_name} {item.last_name}
          </Text>
          <Text style={styles.driverVehicle}>{item.vehicle}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('EditDriver', {driver: item})}>
          <Edit size={20} color="#0891b2" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleToggleActive(item.id, item.is_active)}>
          {item.is_active ? (
            <PowerOff size={20} color="#ef4444" />
          ) : (
            <Power size={20} color="#22c55e" />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(item.id)}>
          <Trash size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0891b2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={drivers}
        renderItem={renderDriver}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No hay choferes registrados</Text>
        }
      />
    </View>
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
  listContainer: {
    padding: 16,
  },
  driverCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  driverVehicle: {
    fontSize: 14,
    color: '#64748b',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 16,
    marginTop: 24,
  },
});

export default DriversManagementScreen;
