import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  StyleSheet,
  Switch,
  Text,
  Platform,
  PermissionsAndroid,
  TouchableOpacity,
  Alert,
  FlatList,
} from 'react-native';
import MapView, {PROVIDER_DEFAULT} from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import {driverService, tripRequestService} from '../services/api';
import NotificationService from '../services/notifications';

const DriverHomeScreen = ({user}) => {
  const [position, setPosition] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const mapRef = useRef(null);
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  useEffect(() => {
    // Iniciar el servicio de notificaciones
    NotificationService.startNotificationService(user.id);

    // Limpiar al desmontar
    return () => {
      NotificationService.stopNotificationService();
    };
  }, [user.id]);
  const getCurrentPosition = () => {
    return new Promise((resolve, reject) => {
      const watchId = Geolocation.watchPosition(
        position => {
          const {latitude, longitude} = position.coords;
          Geolocation.clearWatch(watchId);
          resolve({
            latitude,
            longitude,
            latitudeDelta: 0.001,
            longitudeDelta: 0.001,
          });
        },
        error => {
          Geolocation.clearWatch(watchId);
          reject(error);
        },
        {
          enableHighAccuracy: false,
          timeout: 30000,
          maximumAge: 60000,
          distanceFilter: 0,
        },
      );

      // Timeout de seguridad
      setTimeout(() => {
        Geolocation.clearWatch(watchId);
        reject(new Error('Location request timed out'));
      }, 30000);
    });
  };
  useEffect(() => {
    const fetchPendingRequests = async () => {
      try {
        const requests = await tripRequestService.getDriverPendingRequests(
          user.id,
        );
        setPendingRequests(requests);
      } catch (error) {
        console.error('Error fetching requests:', error);
      }
    };

    fetchPendingRequests();
    // Establecer un intervalo para actualizar las solicitudes
    const interval = setInterval(fetchPendingRequests, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRequestResponse = async (requestId, status) => {
    try {
      await tripRequestService.updateRequestStatus(requestId, status);
      if (status === 'accepted') {
        await tripRequestService.convertRequestToTrip(requestId);
        Alert.alert('Éxito', 'Viaje aceptado');
      }
      setPendingRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Error handling request:', error);
      Alert.alert('Error', 'No se pudo procesar la solicitud');
    }
  };
  useEffect(() => {
    requestLocationPermission();
    loadInitialDriverStatus();
  }, []);

  const loadInitialDriverStatus = async () => {
    try {
      const driverProfile = await driverService.getDriverProfile(user.id);
      if (driverProfile) {
        setIsOnDuty(driverProfile.is_on_duty);
      }
    } catch (error) {
      console.error('Error loading driver status:', error);
    }
  };

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permiso de ubicación',
            message: 'La aplicación necesita acceso a tu ubicación',
            buttonNeutral: 'Preguntar luego',
            buttonNegative: 'Cancelar',
            buttonPositive: 'OK',
          },
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          startLocationTracking();
        }
      } catch (err) {
        console.warn(err);
      }
    } else {
      startLocationTracking();
    }
  };

  const startLocationTracking = async () => {
    try {
      const initialPosition = await getCurrentPosition();

      setPosition(initialPosition);

      if (mapRef.current) {
        mapRef.current.animateToRegion(initialPosition, 1000);
      }

      Geolocation.watchPosition(
        pos => {
          const newPosition = {
            latitude: pos.coords.latitude,

            longitude: pos.coords.longitude,

            latitudeDelta: 0.001,

            longitudeDelta: 0.001,
          };

          setPosition(prev => {
            if (mapRef.current && prev) {
              mapRef.current.animateToRegion(newPosition, 1000);
            }

            return newPosition;
          });
        },

        error => console.error(error),

        {
          enableHighAccuracy: true,

          distanceFilter: 5,

          interval: 5000,

          fastestInterval: 2000,
        },
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo obtener la ubicación inicial');
    }
  };

  const updateDriverLocation = async newPosition => {
    try {
      await driverService.updateLocation(
        user.id,
        newPosition.latitude,
        newPosition.longitude,
      );
    } catch (error) {
      console.error('Error updating location:', error);
      if (!offlineMode) {
        Alert.alert(
          'Error de conexión',
          'No se pudo actualizar la ubicación. ¿Desea activar el modo offline?',
          [
            {
              text: 'Sí',
              onPress: () => setOfflineMode(true),
            },
            {
              text: 'No',
              style: 'cancel',
            },
          ],
        );
      }
    }
  };

  const toggleDutyStatus = async () => {
    try {
      const newStatus = !isOnDuty;
      await driverService.updateDutyStatus(user.id, newStatus);
      setIsOnDuty(newStatus);

      if (newStatus && !offlineMode) {
        await updateDriverLocation(position);
      }

      Alert.alert(
        'Estado actualizado',
        `Ahora estás ${newStatus ? 'en servicio' : 'fuera de servicio'}`,
      );
    } catch (error) {
      console.error('Error updating duty status:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado');
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

  return (
    <View style={styles.container}>
      {pendingRequests.length > 0 && (
        <View style={styles.requestsPanel}>
          <Text style={styles.requestsTitle}>Solicitudes Pendientes</Text>
          <FlatList
            data={pendingRequests}
            renderItem={({item}) => (
              <View style={styles.requestItem}>
                <View>
                  <Text>Origen: {item.origin}</Text>
                  <Text>Destino: {item.destination}</Text>
                  <Text>Precio: ${item.price}</Text>
                  <Text>Operador: {item.operator_profiles.first_name}</Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleRequestResponse(item.id, 'accepted')}>
                    <Text style={styles.buttonText}>Aceptar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleRequestResponse(item.id, 'rejected')}>
                    <Text style={styles.buttonText}>Rechazar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            keyExtractor={item => item.id}
          />
        </View>
      )}
      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <Text style={styles.statusText}>En servicio</Text>
          <Switch
            value={isOnDuty}
            onValueChange={toggleDutyStatus}
            trackColor={{false: '#767577', true: '#81b0ff'}}
            thumbColor={isOnDuty ? '#f5dd4b' : '#f4f3f4'}
          />
        </View>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        customMapStyle={mapStyle}
        region={position}
        showsUserLocation={true}
        followsUserLocation={true}
        showsMyLocationButton={true}
        maxZoomLevel={19}
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
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: 'white',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 16,
  },
  // Nuevos estilos para el panel de solicitudes
  requestsPanel: {
    position: 'absolute',
    top: 80,
    left: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    maxHeight: '50%',
  },
  requestsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  requestItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 10,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    elevation: 2,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    fontWeight: '500',
  },
});

export default DriverHomeScreen;
