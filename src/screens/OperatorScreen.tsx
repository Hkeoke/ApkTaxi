import React, {useState, useRef, useEffect, useLayoutEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  SafeAreaView,
  Modal,
  StyleSheet,
  Animated, // Add this
  ActivityIndicator, // Also add this since it's used in the code
  FlatList,
  ScrollView,
} from 'react-native';
import MapView, {Marker, Circle, PROVIDER_DEFAULT} from 'react-native-maps';
import {X, Car, Bike, Menu, Plus} from 'lucide-react-native';
import Sidebar from '../components/Sidebar';
import {useNavigation} from '@react-navigation/native';
import notifee from '@notifee/react-native';
import {AndroidImportance} from '@notifee/react-native';
import {RealtimeChannel} from '@supabase/supabase-js';
import {Trip} from '../utils/db_types'; // Agregar al inicio con las otras importaciones

//import {Car, Phone, Star, Clock, X} from 'lucide-react-native';
import {driverService, tripRequestService} from '../services/api';

// Primero definimos algunas interfaces necesarias
interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  latitude: string | number;
  longitude: string | number;
  vehicle: string;
  vehicle_type: '2_ruedas' | '4_ruedas';
  is_on_duty: boolean;
  user_id: string;
}

interface Location {
  name: string;
  latitude: number;
  longitude: number;
}

interface OSMResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface User {
  id: string;
  role?: 'admin' | 'operador' | 'chofer';
}

interface OperatorScreenProps {
  user: User;
  role?: 'admin' | 'operador';
  mode?: 'normal' | 'view_drivers';
}

interface Stop {
  name: string;
  latitude: number;
  longitude: number;
}

// Asegurarse de que el tipo de searchMode incluya 'stop'
type SearchMode = 'origin' | 'destination' | 'stop';

const OperatorHomeScreen: React.FC<OperatorScreenProps> = ({
  user,
  role = 'operador',
  mode = 'normal',
}) => {
  const navigation = useNavigation();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const mapRef = useRef<MapView | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    null,
  );
  const [originCoords, setOriginCoords] = useState<Location | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<Location | null>(
    null,
  );
  const [searchRadius, setSearchRadius] = useState(3000);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [viewMode, setViewMode] = useState(mode);
  const [tripSubscription, setTripSubscription] =
    useState<RealtimeChannel | null>(null);

  const [region, setRegion] = useState({
    latitude: 23.1136,
    longitude: -82.3666,
    latitudeDelta: 0.001,
    longitudeDelta: 0.001,
  });

  const [requestForm, setRequestForm] = useState({
    origin: '',
    destination: '',
    price: '',
    observations: '',
    vehicle_type: '4_ruedas' as '2_ruedas' | '4_ruedas',
    passenger_phone: '',
    stops: [] as Stop[],
  });

  // Agregar función para obtener dirección desde coordenadas
  const getAddressFromCoords = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'TaxiApp/1.0',
          },
        },
      );
      const data = await response.json();
      return data.display_name || `${latitude}, ${longitude}`;
    } catch (error) {
      console.error('Error getting address:', error);
      return `${latitude}, ${longitude}`;
    }
  };

  // Modificar handleMapPress para incluir la búsqueda de dirección
  const handleMapPress = async (event: any) => {
    const {coordinate} = event.nativeEvent;
    setLoading(true);

    try {
      const address = await getAddressFromCoords(
        coordinate.latitude,
        coordinate.longitude,
      );

      const newLocation = {
        name: address,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      };

      setSelectedLocation(newLocation);

      // Actualizar el mapa
      mapRef.current?.animateToRegion(
        {
          ...coordinate,
          latitudeDelta: 0.001,
          longitudeDelta: 0.001,
        },
        500,
      );
    } catch (error) {
      console.error('Error en handleMapPress:', error);
      setSelectedLocation({
        name: `${coordinate.latitude.toFixed(
          6,
        )}, ${coordinate.longitude.toFixed(6)}`,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      });
    } finally {
      setLoading(false);
    }
  };

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

  // Update GooglePlacesAutocomplete configuration
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OSMResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Función debounce para no saturar las peticiones
  const debounce = <T extends (...args: any[]) => void>(
    func: T,
    delay: number,
  ) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  };

  const searchLocations = async (query: string) => {
    if (!query) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query,
        )}&format=json&addressdetails=1&countrycodes=cu&limit=5`,
        {
          headers: {
            'User-Agent': 'TuNombreDeApp/1.0 (tucorreo@ejemplo.com)', // Requerido por Nominatim
          },
        },
      );

      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error buscando ubicaciones:', error);
      Alert.alert('Error', 'No se pudo realizar la búsqueda');
    } finally {
      setIsSearching(false);
    }
  };

  const debouncedSearch = debounce(searchLocations, 500);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    debouncedSearch(text);
  };

  const handleOSMSelect = (item: OSMResult) => {
    if (!item) return;

    const location: Location = {
      name: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
    };

    switch (searchMode) {
      case 'origin':
        setRequestForm(prev => ({...prev, origin: location.name}));
        setOriginCoords(location);
        break;
      case 'destination':
        setRequestForm(prev => ({...prev, destination: location.name}));
        setDestinationCoords(location);
        break;
      case 'stop':
        setRequestForm(prev => ({
          ...prev,
          stops: [...prev.stops, location],
        }));
        break;
    }

    setShowLocationModal(false);
    setSearchResults([]);
    setSearchQuery('');
    setSearchMode(null);
  };

  // Agregar función para eliminar paradas
  const handleRemoveStop = (index: number) => {
    setRequestForm(prev => ({
      ...prev,
      stops: prev.stops.filter((_, i) => i !== index),
    }));
  };

  const handleAddStop = () => {
    setSearchMode('stop'); // Asegurarse de que esto se establece correctamente
    setShowLocationModal(true);
  };

  // Componente de búsqueda
  const renderLocationSearchInput = () => (
    <View style={styles.searchContainer}>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar ubicación..."
        placeholderTextColor="#999"
        value={searchQuery}
        onChangeText={handleSearchChange}
      />

      {isSearching && <ActivityIndicator size="small" color="#dc2626" />}

      <FlatList
        data={searchResults}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.resultItem}
            onPress={() => handleOSMSelect(item)}>
            <Text style={styles.resultText}>{item.display_name}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !isSearching && searchQuery !== '' ? (
            <Text style={styles.noResults}>No se encontraron resultados</Text>
          ) : null
        }
      />
    </View>
  );

  const renderStopsList = () => (
    <View style={styles.stopsContainer}>
      <Text style={styles.stopsTitle}>Paradas</Text>
      <TouchableOpacity
        style={styles.addStopButton}
        onPress={() => {
          setSearchMode('stop');
          setShowLocationModal(true);
        }}>
        <Plus size={20} color="#dc2626" />
        <Text style={styles.addStopText}>Agregar parada</Text>
      </TouchableOpacity>
      {requestForm.stops.map((stop, index) => (
        <View key={index} style={styles.stopItem}>
          <Text style={styles.stopText} numberOfLines={1}>
            {stop.name}
          </Text>
          <TouchableOpacity
            style={styles.removeStopButton}
            onPress={() => handleRemoveStop(index)}>
            <X size={20} color="#FF4444" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  const handleSendRequest = async () => {
    try {
      if (!originCoords || !destinationCoords || !requestForm.price) {
        Alert.alert(
          'Error',
          'Por favor complete todos los campos obligatorios',
        );
        return;
      }

      const requestData = {
        operator_id: user.id,
        origin: requestForm.origin,
        destination: requestForm.destination,
        price: Number(requestForm.price),
        origin_lat: originCoords.latitude,
        origin_lng: originCoords.longitude,
        destination_lat: destinationCoords.latitude,
        destination_lng: destinationCoords.longitude,
        search_radius: searchRadius,
        observations: requestForm.observations,
        vehicle_type: requestForm.vehicle_type,
        passenger_phone: requestForm.passenger_phone,
        status: 'broadcasting',
        stops: requestForm.stops,
      };

      console.log('Enviando solicitud:', requestData);

      await tripRequestService.createBroadcastRequest(requestData);

      Alert.alert('Éxito', 'Solicitud enviada a choferes cercanos');
      setRequestForm({
        origin: '',
        destination: '',
        price: '',
        observations: '',
        vehicle_type: '4_ruedas',
        passenger_phone: '',
        stops: [],
      });
      setOriginCoords(null);
      setDestinationCoords(null);
      setShowRequestForm(false);
    } catch (error) {
      console.error('Error sending request:', error);
      Alert.alert('Error', 'No se pudo enviar la solicitud');
    }
  };

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        setLoading(true);
        let availableDrivers;

        if (viewMode === 'view_drivers') {
          availableDrivers = await driverService.getAvailableDrivers();
        } else {
          availableDrivers = await driverService.getAvailableDrivers();
        }

        // Asegurarnos de que los datos son válidos
        const validDrivers = availableDrivers.filter(
          driver =>
            typeof driver.latitude === 'number' &&
            typeof driver.longitude === 'number',
        );

        setDrivers(validDrivers);

        // Solo actualizar la región si hay conductores válidos
        if (validDrivers.length > 0) {
          const newRegion = {
            latitude: Number(validDrivers[0].latitude),
            longitude: Number(validDrivers[0].longitude),
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
          setRegion(newRegion);
          mapRef.current?.animateToRegion(newRegion, 1000);
        } else {
          // Región por defecto si no hay conductores
          setRegion({
            latitude: 23.1136,
            longitude: -82.3666,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      } catch (error) {
        console.error('Error fetching drivers:', error);
        setDrivers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDrivers();
    const interval = setInterval(fetchDrivers, 30000);
    return () => clearInterval(interval);
  }, [viewMode]);

  const showDriverInfo = (driver: Driver) => {
    // Si el conductor ya está seleccionado, no hagas nada
    if (selectedDriver?.id === driver.id) return;

    setSelectedDriver(driver);

    // Anima el panel
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

    if (mapRef.current) {
      mapRef.current.animateToRegion(driverRegion, 1000);
    }
  };

  const hideDriverInfo = () => {
    Animated.timing(slideAnim, {
      toValue: -300,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setSelectedDriver(null);
    });
  };

  // Modificar confirmLocationSelection para usar la dirección obtenida
  const confirmLocationSelection = async () => {
    if (!selectedLocation) return;

    try {
      const locationData = {
        name: selectedLocation.name,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      };

      switch (searchMode) {
        case 'origin':
          setRequestForm(prev => ({...prev, origin: locationData.name}));
          setOriginCoords(locationData);
          break;
        case 'destination':
          setRequestForm(prev => ({...prev, destination: locationData.name}));
          setDestinationCoords(locationData);
          break;
        case 'stop':
          setRequestForm(prev => ({
            ...prev,
            stops: [...prev.stops, locationData],
          }));
          break;
      }

      setShowLocationModal(false);
      setSelectedLocation(null);
      setSearchMode(null);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Ocurrió un error al guardar la ubicación');
    }
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

  const getMarkerColor = (driver: Driver) => {
    if (viewMode === 'view_drivers') {
      return driver.is_on_duty ? '#22c55e' : '#ef4444';
    }
    return '#0891b2';
  };

  // Agregar función para manejar actualizaciones de viajes
  const handleTripUpdate = async (updatedTrip: Trip) => {
    if (updatedTrip.status === 'cancelled') {
      // Mostrar notificación push
      await notifee.displayNotification({
        title: '¡Viaje Cancelado!',
        body: `El viaje ${updatedTrip.id} ha sido cancelado por el conductor`,
        android: {
          channelId: 'trip_updates',
          pressAction: {
            id: 'default',
          },
          importance: AndroidImportance.HIGH,
          sound: 'notification_sound',
        },
        ios: {
          sound: 'notification_sound.wav',
        },
      });
    }
  };

  // Actualizar el useEffect para la suscripción
  useEffect(() => {
    let subscription: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      try {
        if (user?.id) {
          // Crear canal para notificaciones en Android
          await notifee.createChannel({
            id: 'trip_updates',
            name: 'Actualizaciones de Viajes',
            importance: AndroidImportance.HIGH,
            sound: 'notification_sound',
          });

          // Suscribirse a actualizaciones de viajes
          subscription = tripRequestService.subscribeToTripUpdatesForOperator(
            user.id,
            handleTripUpdate,
            error => {
              console.error('Error en suscripción:', error);
            },
          );

          setTripSubscription(subscription);
        }
      } catch (error) {
        console.error('Error configurando suscripción:', error);
      }
    };

    setupSubscription();

    return () => {
      if (subscription) {
        tripRequestService.unsubscribeFromTripUpdates(subscription);
      }
    };
  }, [user?.id]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        //customMapStyle={mapStyle}
        initialRegion={{
          latitude: 23.1136,
          longitude: -82.3666,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}>
        {/* Marcadores de origen y destino */}
        {originCoords && (
          <>
            <Marker coordinate={originCoords} title="Origen" pinColor="green" />
            <Circle
              center={originCoords}
              radius={searchRadius}
              fillColor="rgba(0, 255, 0, 0.1)"
              strokeColor="rgba(0, 255, 0, 0.3)"
            />
          </>
        )}
        {destinationCoords && (
          <Marker
            coordinate={destinationCoords}
            title="Destino"
            pinColor="red"
          />
        )}

        {/* Marcadores de los choferes */}
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

      {/* Botón flotante para mostrar el formulario */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setShowRequestForm(true)}>
        <Plus color="#000" size={24} />
      </TouchableOpacity>

      {showRequestForm && (
        <>
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setShowRequestForm(false)}
          />

          <View style={styles.formWrapper}>
            <ScrollView
              style={styles.formScrollView}
              contentContainerStyle={styles.formScrollContent}
              showsVerticalScrollIndicator={false}>
              <View style={styles.formContainer}>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => {
                    setSearchMode('origin');
                    setShowLocationModal(true);
                  }}>
                  <Text
                    style={[
                      styles.inputText,
                      !requestForm.origin && styles.placeholder,
                    ]}>
                    {requestForm.origin || 'Seleccionar origen'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.input}
                  onPress={() => {
                    setSearchMode('destination');
                    setShowLocationModal(true);
                  }}>
                  <Text
                    style={[
                      styles.inputText,
                      !requestForm.destination && styles.placeholder,
                    ]}>
                    {requestForm.destination || 'Seleccionar destino'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.vehicleTypeContainer}>
                  <Text style={styles.label}>Tipo de vehículo:</Text>
                  <View style={styles.radioGroup}>
                    <TouchableOpacity
                      style={[
                        styles.radioButton,
                        requestForm.vehicle_type === '4_ruedas' &&
                          styles.radioButtonSelected,
                      ]}
                      onPress={() =>
                        setRequestForm(prev => ({
                          ...prev,
                          vehicle_type: '4_ruedas',
                        }))
                      }>
                      <Car
                        size={20}
                        color={
                          requestForm.vehicle_type === '4_ruedas'
                            ? '#dc2626'
                            : '#666'
                        }
                      />
                      <Text style={styles.radioText}>4 ruedas</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.radioButton,
                        requestForm.vehicle_type === '2_ruedas' &&
                          styles.radioButtonSelected,
                      ]}
                      onPress={() =>
                        setRequestForm(prev => ({
                          ...prev,
                          vehicle_type: '2_ruedas',
                        }))
                      }>
                      <Bike
                        size={20}
                        color={
                          requestForm.vehicle_type === '2_ruedas'
                            ? '#dc2626'
                            : '#666'
                        }
                      />
                      <Text style={styles.radioText}>2 ruedas</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Precio"
                  placeholderTextColor="#999"
                  value={requestForm.price}
                  keyboardType="numeric"
                  onChangeText={text =>
                    setRequestForm(prev => ({...prev, price: text}))
                  }
                />

                <TextInput
                  style={[styles.input, styles.observationsInput]}
                  placeholder="Observaciones (opcional)"
                  placeholderTextColor="#999"
                  value={requestForm.observations}
                  multiline={true}
                  numberOfLines={3}
                  onChangeText={text =>
                    setRequestForm(prev => ({...prev, observations: text}))
                  }
                />

                <TextInput
                  style={styles.input}
                  placeholder="Teléfono del cliente"
                  placeholderTextColor="#999"
                  value={requestForm.passenger_phone}
                  keyboardType="phone-pad"
                  onChangeText={text =>
                    setRequestForm(prev => ({...prev, passenger_phone: text}))
                  }
                />

                {renderStopsList()}

                <TouchableOpacity
                  style={styles.requestButton}
                  onPress={handleSendRequest}>
                  <Text style={styles.requestButtonText}>Enviar Solicitud</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </>
      )}

      <Modal
        visible={showLocationModal}
        animationType="slide"
        onRequestClose={() => setShowLocationModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Seleccionar{' '}
              {searchMode === 'origin'
                ? 'origen'
                : searchMode === 'destination'
                ? 'destino'
                : 'parada'}
            </Text>
            <TouchableOpacity
              onPress={() => setShowLocationModal(false)}
              style={styles.closeButton}>
              <X size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            {renderLocationSearchInput()}
          </View>

          <Text style={styles.orText}>- O -</Text>
          <Text style={styles.selectMapText}>
            Selecciona una ubicación en el mapa
          </Text>

          <MapView
            style={styles.modalMap}
            //customMapStyle={mapStyle}
            provider={PROVIDER_DEFAULT}
            region={region}
            onPress={handleMapPress}
            showsUserLocation={true}>
            {selectedLocation && (
              <Marker
                coordinate={selectedLocation}
                draggable
                onDragEnd={async e => {
                  const coordinate = e.nativeEvent.coordinate;
                  const address = await getAddressFromCoords(
                    coordinate.latitude,
                    coordinate.longitude,
                  );
                  setSelectedLocation({
                    name: address,
                    latitude: coordinate.latitude,
                    longitude: coordinate.longitude,
                  });
                }}
              />
            )}
          </MapView>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#dc2626" />
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.confirmButton,
              !selectedLocation && styles.confirmButtonDisabled,
            ]}
            onPress={confirmLocationSelection}
            disabled={!selectedLocation}>
            <Text style={styles.confirmButtonText}>Confirmar ubicación</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setIsSidebarVisible(false)}
        role={role || user.role}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  mapContainerSmall: {
    flex: 1,
  },
  map: {
    flex: 1,
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
  driversList: {
    flex: 1,
    maxHeight: '40%',
  },
  driversListSmall: {
    maxHeight: '30%',
  },
  panelScrollView: {
    maxHeight: '80%',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  loadingText: {
    padding: 16,
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
  },
  driverItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  selectedDriver: {
    backgroundColor: '#f0f9ff',
  },
  driverItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverInfo: {
    marginLeft: 12,
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  vehicleInfo: {
    fontSize: 14,
    color: '#666',
  },

  confirmButtonDisabled: {
    backgroundColor: '#dc2626',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#dc2626',
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
  },
  panelContent: {
    gap: 16,
  },
  driverDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  detailText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },

  listContent: {
    flexGrow: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  autocompleteContainer: {
    flex: 0,
    padding: 20,
  },
  autocompleteInput: {
    fontSize: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  orText: {
    textAlign: 'center',
    fontSize: 16,
    marginVertical: 10,
    color: '#666',
  },
  selectMapText: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 10,
    color: '#333',
  },
  modalMap: {
    flex: 1,
    margin: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  confirmButton: {
    margin: 20,
    backgroundColor: '#dc2626',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    padding: 15,

    backgroundColor: '#fff',
  },

  searchInput: {
    height: 45,

    borderWidth: 1,

    borderColor: '#e0e0e0',

    borderRadius: 8,

    paddingHorizontal: 15,

    marginBottom: 10,
  },

  resultItem: {
    padding: 15,

    borderBottomWidth: 1,

    borderBottomColor: '#eee',
  },

  resultText: {
    fontSize: 14,

    color: '#333',
  },

  noResults: {
    textAlign: 'center',

    color: '#666',

    padding: 10,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#dc2626',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Fondo semi-transparente
  },
  formWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '80%',
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  formScrollView: {
    maxHeight: '100%',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  formScrollContent: {
    flexGrow: 1,
  },
  formContainer: {
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  input: {
    width: '100%',
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    color: '#333',
    marginBottom: 5,
  },
  inputText: {
    fontSize: 16,
    color: '#666',
  },
  placeholder: {
    color: '#999',
  },
  observationsInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  requestButton: {
    backgroundColor: '#dc2626',
    padding: 16,
    borderRadius: 15,
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
  },
  requestButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  markerText: {
    fontSize: 24,
    color: '#0891b2',
  },
  vehicleTypeContainer: {
    width: '100%',
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  radioGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 5,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    width: '45%',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  radioText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{translateX: -20}, {translateY: -20}],
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 10,
    padding: 10,
  },
  stopsContainer: {
    width: '100%',
    marginVertical: 10,
    gap: 8,
  },
  stopsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 8,
  },
  stopText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginRight: 10,
  },
  removeStopButton: {
    padding: 4,
  },
  addStopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
    borderStyle: 'dashed',
    marginBottom: 8,
  },
  addStopText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '500',
  },
});
export default OperatorHomeScreen;
