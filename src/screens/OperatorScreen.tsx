import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Animated,
} from 'react-native';
import MapView, {Marker, PROVIDER_DEFAULT} from 'react-native-maps';
import {Car, Phone, Star, Clock, X} from 'lucide-react-native';
import {driverService} from '../services/api';

const OperatorHomeScreen = () => {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDriverPanel, setShowDriverPanel] = useState(false);
  const slideAnim = new Animated.Value(-300);
  const mapRef = useRef(null);

  const [region, setRegion] = useState({
    latitude: 23.1136,
    longitude: -82.3666,
    latitudeDelta: 0.001,
    longitudeDelta: 0.001,
  });

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
    setSelectedDriver(driver);
    setShowDriverPanel(true);
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
      setShowDriverPanel(false);
      setSelectedDriver(null);
    });
  };

  const handleSendRequest = async () => {
    try {
      await driverService.sendRequest(selectedDriver.id);
      hideDriverInfo();
    } catch (error) {
      console.error('Error sending request:', error);
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
    <SafeAreaView style={styles.container}>
      <View style={styles.mapContainer}>
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

      <View style={styles.driversList}>
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

      {showDriverPanel && selectedDriver && (
        <Animated.View
          style={[
            styles.driverPanel,
            {
              transform: [{translateY: slideAnim}],
            },
          ]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Información del Chofer</Text>
            <TouchableOpacity
              onPress={hideDriverInfo}
              style={styles.closeButton}>
              <X size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.panelContent}>
            <View style={styles.driverDetailRow}>
              <Car size={20} color="#666" />
              <Text style={styles.detailText}>{selectedDriver.vehicle}</Text>
            </View>

            <View style={styles.driverDetailRow}>
              <Phone size={20} color="#666" />
              <Text style={styles.detailText}>
                {selectedDriver.phone_number}
              </Text>
            </View>

            <View style={styles.driverDetailRow}>
              <Star size={20} color="#666" />
            </View>

            <View style={styles.driverDetailRow}>
              <Clock size={20} color="#666" />
              <Text style={styles.detailText}>
                {selectedDriver.is_on_duty
                  ? 'En servicio'
                  : 'Fuera de servicio'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.requestButton}
              onPress={handleSendRequest}>
              <Text style={styles.requestButtonText}>Enviar Solicitud</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 2,
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
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  driverItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  driverItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverInfo: {
    marginLeft: 12,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
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
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  panelContent: {
    gap: 15,
  },
  driverDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    fontSize: 16,
    color: '#333',
  },
  requestButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  requestButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default OperatorHomeScreen;
