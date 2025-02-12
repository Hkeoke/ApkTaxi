import React, {useState, useEffect, useRef} from 'react';
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
                <TextInput
                  style={styles.input}
                  placeholder="Origen"
                  value={requestForm.origin}
                  onChangeText={text =>
                    setRequestForm(prev => ({...prev, origin: text}))
                  }
                />

                <TextInput
                  style={styles.input}
                  placeholder="Destino"
                  value={requestForm.destination}
                  onChangeText={text =>
                    setRequestForm(prev => ({...prev, destination: text}))
                  }
                />

                <TextInput
                  style={styles.input}
                  placeholder="Precio"
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
});
export default OperatorHomeScreen;
