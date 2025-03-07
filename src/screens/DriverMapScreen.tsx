import React, {useState, useRef, useEffect, useLayoutEffect} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Animated,
  Platform,
  ScrollView,
} from 'react-native';
import MapView, {Marker, PROVIDER_DEFAULT} from 'react-native-maps';
import {Car, Bike, Menu, MapPin} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import {driverService} from '../services/api';
import Sidebar from '../components/Sidebar';

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  latitude: string | number;
  longitude: string | number;
  vehicle: string;
  vehicle_type: '2_ruedas' | '4_ruedas';
  is_active: boolean;
  is_on_duty: boolean;
}

const DriverMapScreen = () => {
  const navigation = useNavigation();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const mapRef = useRef<MapView | null>(null);
  const slideAnim = useRef(new Animated.Value(-300)).current;

  const [region, setRegion] = useState({
    latitude: 23.1136,
    longitude: -82.3666,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const mapStyle = [
    {
      elementType: 'geometry',
      stylers: [
        {
          color: '#f5f5f5',
        },
      ],
    },
    {
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#616161',
        },
      ],
    },
    {
      elementType: 'labels.text.stroke',
      stylers: [
        {
          color: '#f5f5f5',
        },
      ],
    },
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [
        {
          color: '#ffffff',
        },
      ],
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [
        {
          color: '#c9c9c9',
        },
      ],
    },
  ];

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const allDrivers = await driverService.getAllDriversWithLocation();
        setDrivers(allDrivers);
        if (allDrivers.length > 0) {
          const newRegion = {
            latitude: Number(allDrivers[0].latitude),
            longitude: Number(allDrivers[0].longitude),
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
          setRegion(newRegion);
          mapRef.current?.animateToRegion(newRegion, 1000);
        }
      } catch (error) {
        console.error('Error fetching drivers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDrivers();
    const interval = setInterval(fetchDrivers, 30000);
    return () => clearInterval(interval);
  }, []);

  const showDriverInfo = (driver: Driver) => {
    if (selectedDriver?.id === driver.id) return;

    setSelectedDriver(driver);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
    }).start();

    const driverRegion = {
      latitude: Number(driver.latitude),
      longitude: Number(driver.longitude),
      latitudeDelta: 0.001,
      longitudeDelta: 0.001,
    };

    mapRef.current?.animateToRegion(driverRegion, 1000);
  };

  const hideDriverInfo = () => {
    Animated.timing(slideAnim, {
      toValue: -300,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setSelectedDriver(null));
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => setIsSidebarVisible(true)}
          style={{marginLeft: 15}}>
          <Menu color="#dc2626" size={24} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const getVehicleIcon = (driver: Driver) => {
    const color = driver.is_on_duty ? '#22c55e' : '#ef4444';
    const icon =
      driver.vehicle_type === '2_ruedas' ? (
        <Bike color={color} size={16} />
      ) : (
        <Car color={color} size={16} />
      );

    return (
      <View style={styles.markerIconContainer}>
        {icon}
        <View style={[styles.markerPin, {backgroundColor: color}]} />
        <View style={styles.markerPinShadow} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        customMapStyle={mapStyle}
        region={region}>
        {drivers.map(driver => (
          <Marker
            key={driver.id}
            coordinate={{
              latitude: Number(driver.latitude),
              longitude: Number(driver.longitude),
            }}
            title={`${driver.first_name} ${driver.last_name}`}
            description={`${
              driver.is_on_duty ? 'En servicio' : 'Fuera de servicio'
            } - ${driver.vehicle}`}
            onPress={() => showDriverInfo(driver)}>
            <View style={styles.markerWrapper}>
              <View
                style={[
                  styles.markerContainer,
                  {
                    borderColor: driver.is_on_duty ? '#22c55e' : '#ef4444',
                  },
                ]}>
                {getVehicleIcon(driver)}
              </View>
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={styles.driversList}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Lista de Choferes</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <View style={[styles.statusDot, {backgroundColor: '#22c55e'}]} />
              <Text style={styles.statText}>
                Activos: {drivers.filter(d => d.is_on_duty).length}
              </Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statusDot, {backgroundColor: '#ef4444'}]} />
              <Text style={styles.statText}>
                Inactivos: {drivers.filter(d => !d.is_on_duty).length}
              </Text>
            </View>
          </View>
        </View>
        <ScrollView
          style={styles.listContent}
          contentContainerStyle={styles.listContentContainer}>
          {drivers.map(driver => (
            <TouchableOpacity
              key={driver.id}
              style={[
                styles.driverCard,
                selectedDriver?.id === driver.id && styles.selectedCard,
              ]}
              onPress={() => showDriverInfo(driver)}>
              <View style={styles.cardHeader}>
                <View style={styles.driverAvatarContainer}>
                  {getVehicleIcon(driver)}
                </View>
                <View style={styles.headerInfo}>
                  <Text style={styles.driverName}>
                    {driver.first_name} {driver.last_name}
                  </Text>
                  <View style={styles.vehicleInfoContainer}>
                    <Car size={14} color="#64748b" />
                    <Text style={styles.vehicleInfoText}>{driver.vehicle}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.statusIndicator,
                    {
                      backgroundColor: driver.is_on_duty
                        ? '#22c55e'
                        : '#ef4444',
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {selectedDriver && (
        <Animated.View
          style={[
            styles.driverInfoPanel,
            {transform: [{translateY: slideAnim}]},
          ]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Información del Chofer</Text>
            <TouchableOpacity onPress={hideDriverInfo}>
              <Text style={styles.closeButton}>×</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.panelContent}>
            <Text style={styles.driverName}>
              {selectedDriver.first_name} {selectedDriver.last_name}
            </Text>
            <Text style={styles.driverInfo}>
              Estado:{' '}
              {selectedDriver.is_on_duty ? 'En servicio' : 'Fuera de servicio'}
            </Text>
            <Text style={styles.driverInfo}>
              Vehículo: {selectedDriver.vehicle}
            </Text>
          </View>
        </Animated.View>
      )}

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
  },
  map: {
    flex: 1,
  },
  driversList: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f8fafc',
    maxHeight: '45%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: -2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  listHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 6,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  listContent: {
    flexGrow: 0,
    backgroundColor: '#f8fafc',
  },
  listContentContainer: {
    padding: 8,
    gap: 6,
    backgroundColor: '#f8fafc',
  },
  driverCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 6,
    height: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: 'transparent',
      },
      android: {
        elevation: 0,
      },
    }),
  },
  selectedCard: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0891b2',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: 'transparent',
      },
      android: {
        elevation: 0,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  driverAvatarContainer: {
    backgroundColor: '#f8fafc',
    padding: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  headerInfo: {
    flex: 1,
    gap: 1,
  },
  driverName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  vehicleInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  vehicleInfoText: {
    fontSize: 11,
    color: '#64748b',
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
    marginRight: 2,
  },
  markerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1.5,
  },
  markerIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  markerPin: {
    position: 'absolute',
    bottom: -10,
    width: 2,
    height: 10,
    borderRadius: 1,
  },
  markerPinShadow: {
    position: 'absolute',
    bottom: -12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    transform: [{scaleX: 2}],
  },
  driverInfoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: -2},
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
    padding: 5,
  },
  panelContent: {
    gap: 8,
  },
  driverInfo: {
    fontSize: 14,
    color: '#64748b',
  },
});

export default DriverMapScreen;
