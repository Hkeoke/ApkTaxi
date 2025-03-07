import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import {Calendar, Search, User, Filter, X} from 'lucide-react-native';
import {analyticsService, driverService} from '../services/api';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Trip {
  id: string;
  origin: string;
  destination: string;
  created_at: string;
  driver_profiles: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  operator_profiles: {
    first_name: string;
    last_name: string;
  } | null;
  price: number;
}

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
}

const DriverReportsScreen = () => {
  const [loading, setLoading] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showDrivers, setShowDrivers] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    try {
      const data = await driverService.getAllDrivers();
      setDrivers(data);
    } catch (error) {
      console.error('Error al cargar choferes:', error);
    }
  };

  const fetchTrips = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Error', 'Por favor ingrese ambas fechas');
      return;
    }

    try {
      setLoading(true);
      const data = await analyticsService.getCompletedTrips(
        `${startDate.toISOString()}T00:00:00`,
        `${endDate.toISOString()}T23:59:59`,
        selectedDriver?.id,
      );
      setTrips(data);
    } catch (error) {
      console.error('Error al obtener viajes:', error);
      Alert.alert('Error', 'Error al obtener los viajes');
    } finally {
      setLoading(false);
    }
  };

  const filteredDrivers = drivers.filter(
    driver =>
      driver.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.last_name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const renderTrip = ({item}: {item: Trip}) => (
    <View style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <Text style={styles.tripDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
        <Text style={styles.tripPrice}>${item.price}</Text>
      </View>

      <View style={styles.tripDetails}>
        <Text style={styles.label}>Origen:</Text>
        <Text style={styles.value}>{item.origin}</Text>
        <Text style={styles.label}>Destino:</Text>
        <Text style={styles.value}>{item.destination}</Text>
      </View>

      <View style={styles.tripFooter}>
        <View style={styles.personInfo}>
          <Text style={styles.label}>Chofer:</Text>
          <Text style={styles.value}>
            {item.driver_profiles
              ? `${item.driver_profiles.first_name} ${item.driver_profiles.last_name}`
              : 'No asignado'}
          </Text>
        </View>
        <View style={styles.personInfo}>
          <Text style={styles.label}>Operador:</Text>
          <Text style={styles.value}>
            {item.operator_profiles
              ? `${item.operator_profiles.first_name} ${item.operator_profiles.last_name}`
              : 'No asignado'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filtersContainer}>
        <View style={styles.dateFilters}>
          <TouchableOpacity
            style={styles.inputContainer}
            onPress={() => setShowStartPicker(true)}>
            <Calendar size={20} color="#dc2626" />
            <Text style={styles.input}>{startDate.toLocaleDateString()}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.inputContainer}
            onPress={() => setShowEndPicker(true)}>
            <Calendar size={20} color="#dc2626" />
            <Text style={styles.input}>{endDate.toLocaleDateString()}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.driverFilter}>
          <TouchableOpacity
            style={styles.driverSelector}
            onPress={() => setShowDrivers(!showDrivers)}>
            <User size={20} color="#dc2626" />
            <Text style={styles.driverSelectorText}>
              {selectedDriver
                ? `${selectedDriver.first_name} ${selectedDriver.last_name}`
                : 'Seleccionar Chofer'}
            </Text>
            {selectedDriver && (
              <TouchableOpacity
                onPress={() => setSelectedDriver(null)}
                style={styles.clearButton}>
                <X size={16} color="#dc2626" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.searchButton}
            onPress={fetchTrips}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#dc2626" />
            ) : (
              <Search size={24} color="#dc2626" />
            )}
          </TouchableOpacity>
        </View>

        {showDrivers && (
          <View style={styles.driversDropdown}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar chofer..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor="#94a3b8"
            />
            <FlatList
              data={filteredDrivers}
              keyExtractor={item => item.id}
              style={styles.driversList}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.driverItem}
                  onPress={() => {
                    setSelectedDriver(item);
                    setShowDrivers(false);
                    setSearchTerm('');
                  }}>
                  <Text style={styles.driverName}>
                    {item.first_name} {item.last_name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      <FlatList
        data={trips}
        renderItem={renderTrip}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No hay viajes en este período</Text>
        }
      />

      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          onChange={(event, date) => {
            setShowStartPicker(false);
            if (date) setStartDate(date);
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          onChange={(event, date) => {
            setShowEndPicker(false);
            if (date) setEndDate(date);
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  filtersContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  dateFilters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 44,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#0f172a',
  },
  driverFilter: {
    flexDirection: 'row',
    gap: 8,
  },
  driverSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 44,
  },
  driverSelectorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#0f172a',
  },
  clearButton: {
    padding: 4,
  },
  searchButton: {
    backgroundColor: 'transparent',
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driversDropdown: {
    position: 'absolute',
    top: '100%',
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
  searchInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  driversList: {
    maxHeight: 200,
  },
  driverItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  driverName: {
    fontSize: 14,
    color: '#0f172a',
  },
  listContainer: {
    padding: 16,
  },
  tripCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tripDate: {
    fontSize: 14,
    color: '#dc2626',
  },
  tripPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
  tripDetails: {
    marginBottom: 12,
  },
  tripFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
    gap: 8,
  },
  personInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: '#64748b',
    marginRight: 8,
    minWidth: 60,
  },
  value: {
    fontSize: 14,
    color: '#0f172a',
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 16,
    marginTop: 24,
  },
});

export default DriverReportsScreen;
