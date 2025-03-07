import React, {useState, useEffect} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import {
  User,
  Edit,
  Trash,
  Power,
  PowerOff,
  Phone,
  Car,
  TrendingUp,
} from 'lucide-react-native';
import {authService, driverService} from '../services/api';

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  vehicle: string;
  is_active: boolean;
  created_at: string;
  users: {
    active: boolean;
  };
}

const DriversListScreen = ({navigation}: {navigation: any}) => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      fetchDrivers();
    }, []),
  );

  const fetchDrivers = async () => {
    try {
      const response = await driverService.getAllDrivers();
      setDrivers(response as Driver[]);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los choferes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggleActive = async (
    driverId: string,
    currentStatus: boolean,
  ) => {
    try {
      await driverService.desactivateUser(
        driverId,
        currentStatus ? false : true,
      );
      fetchDrivers();
      Alert.alert(
        'Éxito',
        `Chofer ${currentStatus ? 'desactivado' : 'activado'} correctamente`,
      );
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
              await authService.deleteUser(driverId);
              fetchDrivers();
              Alert.alert('Éxito', 'Chofer eliminado correctamente');
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar el chofer');
            }
          },
        },
      ],
    );
  };

  const filteredDrivers = drivers.filter(driver => {
    const fullName = `${driver.first_name} ${driver.last_name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      fullName.includes(query) ||
      driver.phone_number.includes(query) ||
      driver.vehicle.toLowerCase().includes(query)
    );
  });

  const renderDriver = ({item}: {item: Driver}) => (
    <View style={styles.driverCard}>
      <View style={styles.driverHeader}>
        <View style={styles.driverAvatar}>
          <User size={24} color="#dc2626" />
        </View>
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>
            {item.first_name} {item.last_name}
          </Text>
          <View style={styles.statusBadge}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: item.users?.active ? '#22c55e' : '#ef4444',
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                {
                  color: item.users?.active ? '#22c55e' : '#ef4444',
                },
              ]}>
              {item.users?.active ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.driverDetails}>
        <View style={styles.detailItem}>
          <Phone size={16} color="#64748b" />
          <Text style={styles.detailText}>{item.phone_number}</Text>
        </View>
        <View style={styles.detailItem}>
          <Car size={16} color="#64748b" />
          <Text style={styles.detailText}>{item.vehicle}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => navigation.navigate('EditDriver', {driver: item})}>
          <Edit size={20} color="#0891b2" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: item.users?.active ? '#fee2e2' : '#dcfce7',
            },
          ]}
          onPress={() =>
            handleToggleActive(item.id, item.users?.active || false)
          }>
          {item.users?.active ? (
            <PowerOff size={20} color="#ef4444" />
          ) : (
            <Power size={20} color="#22c55e" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item.id)}>
          <Trash size={20} color="#ef4444" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.statsButton]}
          onPress={() =>
            navigation.navigate('DriverTripsAnalytics', {
              driverId: item.id,
            })
          }>
          <TrendingUp size={20} color="#0891b2" />
        </TouchableOpacity>
      </View>
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
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, teléfono o vehículo..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94a3b8"
        />
      </View>

      <FlatList
        data={filteredDrivers}
        renderItem={renderDriver}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        onRefresh={fetchDrivers}
        refreshing={refreshing}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {searchQuery
              ? 'No se encontraron choferes con esa búsqueda'
              : 'No hay choferes registrados'}
          </Text>
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
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  driverAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  driverDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 4,
    marginBottom: 4,
    gap: 2,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 4,
    color: '#64748b',
    fontSize: 11,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    flexWrap: 'nowrap',
    marginTop: 4,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  editButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  statsButton: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 16,
    marginTop: 24,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInput: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 14,
    color: '#1e293b',
  },
});

export default DriversListScreen;
