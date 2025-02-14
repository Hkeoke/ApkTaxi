import React, {useState, useEffect, useRef} from 'react';
import 'react-native-get-random-values';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  Modal,
  ActivityIndicator,
} from 'react-native';
import MapView, {Marker, PROVIDER_DEFAULT} from 'react-native-maps';

import {Car, Phone, Star, Clock, X} from 'lucide-react-native';
import {driverService, tripRequestService} from '../services/api';

const OperatorHomeScreen = ({user}) => {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const mapRef = useRef(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [searchMode, setSearchMode] = useState(null); // 'origin' o 'destination'
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);

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
  });
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      },
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      },
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);
  const handleMapPress = event => {
    const {coordinate} = event.nativeEvent;
    setSelectedLocation(coordinate);

    // Animate map to selected location
    mapRef.current?.animateToRegion(
      {
        ...coordinate,
      },
      500,
    );
  };

  // Update GooglePlacesAutocomplete configuration
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Función debounce para no saturar las peticiones
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  };

  const searchLocations = async query => {
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

  const handleSearchChange = text => {
    setSearchQuery(text);
    debouncedSearch(text);
  };

  const handleOSMSelect = item => {
    const location = {
      name: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
    };

    if (searchMode === 'origin') {
      setRequestForm(prev => ({...prev, origin: location.name}));
      setOriginCoords(location);
    } else {
      setRequestForm(prev => ({...prev, destination: location.name}));
      setDestinationCoords(location);
    }

    setShowLocationModal(false);
    setSearchResults([]);
    setSearchQuery('');
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

      {isSearching && <ActivityIndicator size="small" color="#000" />}

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

  const handleSendRequest = async () => {
    try {
      if (!selectedDriver) return;

      await tripRequestService.createRequest({
        driver_id: selectedDriver.id,
        operator_id: user.id,
        origin: requestForm.origin,
        destination: requestForm.destination,
        price: Number(requestForm.price),
      });

      Alert.alert('Éxito', 'Solicitud enviada al chofer');
      hideDriverInfo();
      Keyboard.dismiss();
    } catch (error) {
      console.error('Error sending request:', error);
      Alert.alert('Error', 'No se pudo enviar la solicitud');
    }
  };

  const mapStyle = [
    {
      elementType: 'geometry',
      stylers: [{color: '#f5f5f5'}],
    },
    {
      elementType: 'labels.text.fill',
      stylers: [{color: '#616161'}],
    },
    {
      elementType: 'labels.text.stroke',
      stylers: [{color: '#f5f5f5'}],
    },
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [{color: '#ffffff'}],
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{color: '#c9c9c9'}],
    },
  ];

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const availableDrivers = await driverService.getAvailableDrivers();
        setDrivers(availableDrivers);
        if (availableDrivers.length > 0) {
          const newRegion = {
            latitude: Number(availableDrivers[0].latitude),
            longitude: Number(availableDrivers[0].longitude),
            latitudeDelta: 0.001,
            longitudeDelta: 0.001,
          };
          setRegion(newRegion);
          if (mapRef.current) {
            mapRef.current.animateToRegion(newRegion, 1000);
          }
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

  const showDriverInfo = driver => {
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

  const confirmLocationSelection = async () => {
    if (!selectedLocation) return;

    try {
      const locationData = {
        name: `${selectedLocation.latitude.toFixed(
          6,
        )}, ${selectedLocation.longitude.toFixed(6)}`,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      };

      if (searchMode === 'origin') {
        setRequestForm(prev => ({...prev, origin: locationData.name}));
        setOriginCoords(locationData);
      } else {
        setRequestForm(prev => ({...prev, destination: locationData.name}));
        setDestinationCoords(locationData);
      }

      setShowLocationModal(false);
      setSelectedLocation(null);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Ocurrió un error al guardar la ubicación');
    }
  };
  const renderDriverItem = ({item}) => (
    <TouchableOpacity
      style={[
        styles.driverItem,
        selectedDriver?.id === item.id && styles.selectedDriver,
      ]}
      onPress={() => showDriverInfo(item)}>
      <View style={styles.driverItemContent}>
        <Car size={24} color={item.is_on_duty ? '#4CAF50' : '#9E9E9E'} />
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>
            {`${item.first_name} ${item.last_name}`}
          </Text>
          <Text style={styles.vehicleInfo}>{item.vehicle}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View
          style={[
            styles.mapContainer,
            keyboardVisible && styles.mapContainerSmall,
          ]}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            customMapStyle={mapStyle}
            region={region}
            onRegionChangeComplete={setRegion}
            onPress={handleMapPress}
            showsUserLocation={true}
            showsMyLocationButton={true}
            maxZoomLevel={19}>
            {drivers.map(driver => (
              <Marker
                key={driver.id}
                coordinate={{
                  latitude: Number(driver.latitude),
                  longitude: Number(driver.longitude),
                }}
                onPress={() => showDriverInfo(driver)}>
                <View style={styles.markerContainer}>
                  <Car
                    size={12}
                    color={driver.is_on_duty ? '#4CAF50' : '#9E9E9E'}
                  />
                </View>
              </Marker>
            ))}
            {originCoords && (
              <Marker
                coordinate={{
                  latitude: originCoords.latitude,
                  longitude: originCoords.longitude,
                }}
                pinColor="green"
                title="Origen"
              />
            )}
            {destinationCoords && (
              <Marker
                coordinate={{
                  latitude: destinationCoords.latitude,
                  longitude: destinationCoords.longitude,
                }}
                pinColor="red"
                title="Destino"
              />
            )}
          </MapView>
        </View>

        <View
          style={[
            styles.driversList,
            keyboardVisible && styles.driversListSmall,
          ]}>
          <Text style={styles.listTitle}>Choferes Disponibles</Text>
          {loading ? (
            <Text style={styles.loadingText}>Cargando choferes...</Text>
          ) : (
            <FlatList
              data={drivers}
              renderItem={renderDriverItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>

        {selectedDriver && (
          <Animated.View
            style={[
              styles.driverPanel,
              {
                transform: [{translateY: slideAnim}],
              },
            ]}>
            <ScrollView style={styles.panelScrollView}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Información del Chofer</Text>
                <TouchableOpacity
                  onPress={hideDriverInfo}
                  style={styles.closeButton}>
                  <X size={24} color="#000" />
                </TouchableOpacity>
              </View>

              <View style={styles.panelContent}>
                {/* Driver details */}
                <View style={styles.driverDetailRow}>
                  <Car size={20} color="#666" />
                  <Text style={styles.detailText}>
                    {selectedDriver.vehicle}
                  </Text>
                </View>

                <View style={styles.driverDetailRow}>
                  <Phone size={20} color="#666" />
                  <Text style={styles.detailText}>
                    {selectedDriver.phone_number}
                  </Text>
                </View>

                <View style={styles.driverDetailRow}>
                  <Clock size={20} color="#666" />
                  <Text style={styles.detailText}>
                    {selectedDriver.is_on_duty
                      ? 'En servicio'
                      : 'Fuera de servicio'}
                  </Text>
                </View>

                {/* Form inputs */}
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => {
                    setSearchMode('origin');
                    setShowLocationModal(true);
                  }}>
                  <Text style={styles.inputText}>
                    {requestForm.origin || 'Seleccionar origen'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.input}
                  onPress={() => {
                    setSearchMode('destination');
                    setShowLocationModal(true);
                  }}>
                  <Text style={styles.inputText}>
                    {requestForm.destination || 'Seleccionar destino'}
                  </Text>
                </TouchableOpacity>
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

                <TouchableOpacity
                  style={styles.requestButton}
                  onPress={handleSendRequest}>
                  <Text style={styles.requestButtonText}>Enviar Solicitud</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        )}
        <Modal
          visible={showLocationModal}
          animationType="slide"
          onRequestClose={() => setShowLocationModal(false)}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Seleccionar {searchMode === 'origin' ? 'origen' : 'destino'}
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
              provider={PROVIDER_DEFAULT}
              region={region}
              onPress={handleMapPress}
              showsUserLocation={true}>
              {selectedLocation && (
                <Marker
                  coordinate={selectedLocation}
                  draggable
                  onDragEnd={e => setSelectedLocation(e.nativeEvent.coordinate)}
                />
              )}
            </MapView>

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
      </SafeAreaView>
    </KeyboardAvoidingView>
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
  markerContainer: {
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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
    color: '#666',
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
  driverPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
    maxHeight: Platform.OS === 'ios' ? '70%' : '80%',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    color: '#333',
  },
  requestButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  requestButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  inputText: {
    fontSize: 16,
    color: '#333',
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
});
export default OperatorHomeScreen;
