import React, {useState, useRef, useEffect} from 'react';
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
} from 'react-native';
import MapView, {Marker, Circle, PROVIDER_DEFAULT} from 'react-native-maps';
import {X, Car} from 'lucide-react-native';

//import {Car, Phone, Star, Clock, X} from 'lucide-react-native';
import {driverService, tripRequestService} from '../services/api';

const OperatorHomeScreen = ({user}) => {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const mapRef = useRef(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [searchMode, setSearchMode] = useState(null); // 'origin' o 'destination'
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [searchRadius, setSearchRadius] = useState(3000);

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
  });
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
        status: 'pending', // Asegurarse de que esté en estado pending
      };

      await tripRequestService.createBroadcastRequest(requestData);

      Alert.alert('Éxito', 'Solicitud enviada a choferes cercanos');
      setRequestForm({
        origin: '',
        destination: '',
        price: '',
        observations: '', // Reset observations
      });
      setOriginCoords(null);
      setDestinationCoords(null);
    } catch (error) {
      console.error('Error sending request:', error);
      Alert.alert('Error', 'No se pudo enviar la solicitud');
    }
  };

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

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        customMapStyle={mapStyle}
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
            description={`Vehículo: ${driver.vehicle}`}
            pinColor="blue"
            onPress={() => showDriverInfo(driver)}>
            <View style={styles.markerContainer}>
              <Text style={styles.markerText}>
                <Car />
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

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

        <TouchableOpacity
          style={styles.requestButton}
          onPress={handleSendRequest}>
          <Text style={styles.requestButtonText}>Enviar Solicitud</Text>
        </TouchableOpacity>
      </View>
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
            customMapStyle={mapStyle}
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
  formContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
  requestButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 15,
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
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
  placeholder: {
    color: '#999',
  },
  observationsInput: {
    height: 80, // Make it taller for multiple lines
    textAlignVertical: 'top', // Start text from top
    paddingTop: 12, // Add some padding at the top
  },
});
export default OperatorHomeScreen;
