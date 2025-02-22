import React, {useState, useRef, useEffect, useLayoutEffect} from 'react';
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
import {useNavigation} from '@react-navigation/native';

import MapView, {
  PROVIDER_DEFAULT,
  Polyline,
  UrlTile,
  Marker,
  Region,
} from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import {driverService, tripRequestService} from '../services/api';
import {
  MapPinIcon,
  Navigation2Icon,
  FlagIcon,
  UserIcon,
  Menu,
} from 'lucide-react-native';
import Sidebar from '../components/Sidebar';

interface TripRequest {
  id: string;
  origin: string;
  destination: string;
  price: number;
}

interface Trip {
  id: string;
  origin: string;
  destination: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
}

interface Route {
  distance: string;
  duration: string;
  polyline: Array<{
    latitude: number;
    longitude: number;
  }>;
}

interface Position {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const DriverHomeScreen: React.FC<{user: {id: string}}> = ({user}) => {
  const [position, setPosition] = useState<Position | null>(null);
  const [pendingRequests, setPendingRequests] = useState<TripRequest[]>([]);
  const mapRef = useRef<MapView | null>(null);
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [tripPhase, setTripPhase] = useState<
    'toPickup' | 'toDestination' | null
  >(null);
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const navigation = useNavigation();

  const calculateRoute = async (
    start: {latitude: number; longitude: number},
    end: {latitude: number; longitude: number},
  ): Promise<Route> => {
    try {
      // OSRM espera las coordenadas en formato [longitude,latitude]
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`,
      );

      const data = await response.json();

      if (data.code === 'Ok' && data.routes.length > 0) {
        const route = data.routes[0];

        // Convertir las coordenadas de GeoJSON [longitude,latitude] a [latitude,longitude]
        const points = route.geometry.coordinates.map((coord: any) => ({
          latitude: coord[1],
          longitude: coord[0],
        }));

        return {
          distance: (route.distance / 1000).toFixed(1) + ' km', // Convertir metros a kilómetros
          duration: Math.round(route.duration / 60) + ' min', // Convertir segundos a minutos
          polyline: points,
        };
      }
      throw new Error('No se pudo calcular la ruta');
    } catch (error) {
      console.error('Error calculating route:', error);
      return {
        distance: '0 km',
        duration: '0 min',
        polyline: [],
      };
    }
  };

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
      if (!position) {
        console.log('No position available');
        return;
      }

      try {
        console.log('Fetching requests with position:', {});

        const requests = await tripRequestService.getDriverPendingRequests(
          user.id,
        );

        console.log('Received requests:', requests);
        setPendingRequests(requests);
      } catch (error) {
        console.error('Error fetching requests:', error);
      }
    };

    if (isOnDuty) {
      // Solo buscar solicitudes si está en servicio
      fetchPendingRequests();
      const interval = setInterval(fetchPendingRequests, 10000);
      return () => clearInterval(interval);
    }
  }, [position, isOnDuty]); // Agregar position e isOnDuty como dependencias

  const handleRequestResponse = async (
    requestId: string,
    status: 'accepted' | 'rejected',
  ) => {
    try {
      await tripRequestService.updateRequestStatus(requestId, status);

      if (status === 'accepted') {
        const tripDetails = await tripRequestService.convertRequestToTrip(
          requestId,
        );

        if (
          !tripDetails ||
          !tripDetails.origin_lat ||
          !tripDetails.origin_lng
        ) {
          throw new Error('Invalid trip details received');
        }

        setActiveTrip(tripDetails);
        setTripPhase('toPickup');

        if (position) {
          const pickupLocation = {
            latitude: tripDetails.origin_lat,
            longitude: tripDetails.origin_lng,
          };

          // Calcular ruta al punto de recogida usando OSRM
          const route = await calculateRoute(
            {
              latitude: position.latitude,
              longitude: position.longitude,
            },
            pickupLocation,
          );

          setCurrentRoute(route);

          // Agregar marcadores de inicio y fin a las coordenadas para el ajuste
          const coordinates = [
            {
              latitude: position.latitude,
              longitude: position.longitude,
            },
            ...route.polyline,
            pickupLocation,
          ];

          mapRef.current?.fitToCoordinates(coordinates, {
            edgePadding: {top: 50, right: 50, bottom: 50, left: 50},
            animated: true,
          });
        }

        Alert.alert('Éxito', 'Viaje aceptado');
      }

      setPendingRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Error handling request:', error);
      Alert.alert(
        'Error',
        'No se pudo procesar la solicitud. Por favor, intente nuevamente.',
      );
    }
  };
  const handleArrivalAtPickup = async () => {
    try {
      if (!activeTrip?.id) return;
      await tripRequestService.updateTripStatus(
        activeTrip.id,
        'pickup_reached',
      );
      setTripPhase('toDestination');

      const startLocation = {
        latitude: activeTrip?.origin_lat,
        longitude: activeTrip?.origin_lng,
      };

      const endLocation = {
        latitude: activeTrip?.destination_lat,
        longitude: activeTrip?.destination_lng,
      };

      // Calcular ruta al destino usando OSRM
      const route = await calculateRoute(startLocation, endLocation);
      setCurrentRoute(route);

      // Incluir todos los puntos de la ruta para un mejor ajuste del mapa
      const coordinates = [startLocation, ...route.polyline, endLocation];

      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: {top: 50, right: 50, bottom: 50, left: 50},
        animated: true,
      });
    } catch (error) {
      console.error('Error updating trip status:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado del viaje');
    }
  };
  const handleTripCompletion = async () => {
    try {
      if (!activeTrip?.id) return;
      await tripRequestService.updateTripStatus(activeTrip.id, 'completed');
      setActiveTrip(null);
      setTripPhase(null);
      setCurrentRoute(null);
      Alert.alert('Éxito', 'Viaje completado exitosamente');
    } catch (error) {
      console.error('Error completing trip:', error);
      Alert.alert('Error', 'No se pudo completar el viaje');
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

      setPosition(initialPosition as Position);

      if (mapRef.current) {
        mapRef.current.animateToRegion(initialPosition as Region, 1000);
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

  // En DriverHomeScreen.js, modificar updateDriverLocation
  const updateDriverLocation = async (newPosition: Position) => {
    if (!isOnDuty) return; // No actualizar si no está en servicio

    try {
      console.log('Updating location:', newPosition);
      await driverService.updateLocation(
        user.id,
        newPosition.latitude,
        newPosition.longitude,
      );
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  // Agregar efecto para actualizar la ubicación cuando cambia la posición
  useEffect(() => {
    if (position && isOnDuty) {
      updateDriverLocation(position);
    }
  }, [position, isOnDuty]);

  const toggleDutyStatus = async () => {
    try {
      const newStatus = !isOnDuty;
      await driverService.updateDriverStatus(user.id, newStatus);
      setIsOnDuty(newStatus);

      if (newStatus && !offlineMode) {
        if (position) {
          await updateDriverLocation(position);
        }
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => setIsSidebarVisible(true)}
          style={{marginLeft: 15}}>
          <Menu color="#0891b2" size={24} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      {activeTrip ? (
        <View style={styles.navigationPanel}>
          <Text style={styles.navigationTitle}>
            {tripPhase === 'toPickup'
              ? 'Navegando al punto de recogida'
              : 'Navegando al destino'}
          </Text>

          <View style={styles.tripDetails}>
            <View style={styles.addressContainer}>
              {tripPhase === 'toPickup' ? (
                <>
                  <MapPinIcon size={24} color="#3B82F6" />
                  <Text style={styles.addressText}>
                    Recoger en: {activeTrip.origin}
                  </Text>
                </>
              ) : (
                <>
                  <FlagIcon size={24} color="#22C55E" />
                  <Text style={styles.addressText}>
                    Destino: {activeTrip.destination}
                  </Text>
                </>
              )}
            </View>

            {currentRoute && currentRoute.polyline && (
              <>
                <Polyline
                  coordinates={currentRoute.polyline}
                  strokeWidth={4}
                  strokeColor="#2196F3"
                  geodesic={true}
                />
                {activeTrip && (
                  <>
                    <Marker
                      coordinate={{
                        latitude: activeTrip.origin_lat,
                        longitude: activeTrip.origin_lng,
                      }}
                      title="Punto de recogida"
                    />
                    <Marker
                      coordinate={{
                        latitude: activeTrip.destination_lat,
                        longitude: activeTrip.destination_lng,
                      }}
                      title="Destino"
                    />
                  </>
                )}
              </>
            )}

            <TouchableOpacity
              style={styles.arrivalButton}
              onPress={
                tripPhase === 'toPickup'
                  ? handleArrivalAtPickup
                  : handleTripCompletion
              }>
              <Text style={styles.buttonText}>
                {tripPhase === 'toPickup'
                  ? 'He llegado al punto de recogida'
                  : 'Finalizar viaje'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Existing pending requests panel code...
        pendingRequests.length > 0 && (
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
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.acceptButton]}
                      onPress={() =>
                        handleRequestResponse(item.id, 'accepted')
                      }>
                      <Text style={styles.buttonText}>Aceptar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() =>
                        handleRequestResponse(item.id, 'rejected')
                      }>
                      <Text style={styles.buttonText}>Rechazar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              keyExtractor={item => item.id}
            />
          </View>
        )
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
        region={position as Region}
        showsUserLocation={true}
        followsUserLocation={true}
        showsMyLocationButton={true}
        maxZoomLevel={19}>
        <UrlTile
          urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
          zIndex={-1}
          maximumZ={19}
        />
        {currentRoute && currentRoute.polyline && (
          <>
            <Polyline
              coordinates={currentRoute.polyline}
              strokeWidth={4}
              strokeColor="#2196F3"
              geodesic={true}
            />
            {activeTrip && (
              <>
                <Marker
                  coordinate={{
                    latitude: activeTrip.origin_lat,
                    longitude: activeTrip.origin_lng,
                  }}
                  title="Punto de recogida"
                />
                <Marker
                  coordinate={{
                    latitude: activeTrip.destination_lat,
                    longitude: activeTrip.destination_lng,
                  }}
                  title="Destino"
                />
              </>
            )}
          </>
        )}
      </MapView>
      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setIsSidebarVisible(false)}
        role="chofer"
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
  navigationPanel: {
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
  },
  navigationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  tripDetails: {
    gap: 12,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  addressText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  arrivalButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  routeInfo: {
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 4,
    marginVertical: 8,
  },
  routeInfoText: {
    fontSize: 14,
    color: '#666',
  },
});

export default DriverHomeScreen;
