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
  Linking,
  Animated,
  Pressable,
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
  PhoneIcon,
  MessageSquareIcon,
  CheckIcon,
  XIcon,
} from 'lucide-react-native';
import Sidebar from '../components/Sidebar';

interface TripRequest {
  id: string;
  origin: string;
  destination: string;
  price: number;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  search_radius: number;
  vehicle_type: string;
  status: string;
  created_by: string;
  observations?: string;
}

interface Trip {
  id: string;
  origin: string;
  destination: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  price: number;
  status: string;
  driver_id?: string;
  created_by: string;
  search_radius: number;
  passenger_phone?: string;
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

const DriverHomeScreen: React.FC<{
  user: {
    id: string;
    driver_profiles: {
      vehicle_type: string;
    };
  };
}> = ({user}) => {
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
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const calculateRoute = async (
    start: {latitude: number; longitude: number},
    end: {latitude: number; longitude: number},
  ): Promise<Route> => {
    try {
      // Agregamos parámetros para mayor precisión:
      // steps=true: incluye información detallada de cada paso
      // geometries=geojson: formato más preciso para coordenadas
      // overview=full: obtiene todos los puntos de la ruta sin simplificar
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?steps=true&geometries=geojson&overview=full`,
      );

      const data = await response.json();

      if (data.code === 'Ok' && data.routes.length > 0) {
        const route = data.routes[0];

        // Extraer todos los puntos de los pasos para mayor precisión
        let allPoints: Array<{latitude: number; longitude: number}> = [];

        // Obtener puntos detallados de cada paso
        route.legs[0].steps.forEach((step: any) => {
          const points = step.geometry.coordinates.map(
            (coord: [number, number]) => ({
              latitude: coord[1],
              longitude: coord[0],
            }),
          );
          allPoints = [...allPoints, ...points];
        });

        return {
          distance: (route.distance / 1000).toFixed(1) + ' km',
          duration: Math.round(route.duration / 60) + ' min',
          polyline: allPoints,
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
        console.log('No hay posición disponible');
        return;
      }

      if (!isOnDuty) {
        console.log('Conductor no está en servicio');
        return;
      }

      try {
        console.log('Estado del conductor:', {
          id: user.id,
          vehicleType: user.driver_profiles.vehicle_type,
          position,
          isOnDuty,
        });

        const requests = await tripRequestService.getDriverPendingRequests(
          user.id,
          user.driver_profiles.vehicle_type,
        );

        console.log('Solicitudes pendientes recibidas:', requests);

        if (requests.length > 0) {
          // Calcular la ruta entre origen y destino de la solicitud
          const route = await calculateRoute(
            {
              latitude: requests[0].origin_lat,
              longitude: requests[0].origin_lng,
            },
            {
              latitude: requests[0].destination_lat,
              longitude: requests[0].destination_lng,
            },
          );
          setCurrentRoute(route);

          // Ajustar el mapa para mostrar la ruta completa
          const coordinates = [
            {
              latitude: requests[0].origin_lat,
              longitude: requests[0].origin_lng,
            },
            ...route.polyline,
            {
              latitude: requests[0].destination_lat,
              longitude: requests[0].destination_lng,
            },
          ];

          mapRef.current?.fitToCoordinates(coordinates, {
            edgePadding: {top: 50, right: 50, bottom: 50, left: 50},
            animated: true,
          });
        }

        setPendingRequests(requests);
      } catch (error) {
        console.error('Error al obtener solicitudes:', error);
      }
    };

    if (isOnDuty && position) {
      fetchPendingRequests();
      const interval = setInterval(fetchPendingRequests, 10000);
      return () => clearInterval(interval);
    }
  }, [position, isOnDuty, user.id, user.driver_profiles.vehicle_type]);

  const handleRequestResponse = async (
    requestId: string,
    status: 'accepted' | 'rejected',
  ) => {
    try {
      await tripRequestService.updateRequestStatus(requestId, status);

      if (status === 'accepted') {
        const tripDetails = (await tripRequestService.convertRequestToTrip(
          requestId,
        )) as Trip;

        if (!tripDetails) {
          throw new Error('Invalid trip details received');
        }

        setActiveTrip(tripDetails);
        setTripPhase('toPickup');

        if (position) {
          // Calcular ruta desde la posición actual del conductor hasta el punto de recogida
          const route = await calculateRoute(
            {
              latitude: position.latitude,
              longitude: position.longitude,
            },
            {
              latitude: tripDetails.origin_lat,
              longitude: tripDetails.origin_lng,
            },
          );

          setCurrentRoute(route);

          // Ajustar el mapa para mostrar la ruta al punto de recogida
          const coordinates = [
            {
              latitude: position.latitude,
              longitude: position.longitude,
            },
            ...route.polyline,
            {
              latitude: tripDetails.origin_lat,
              longitude: tripDetails.origin_lng,
            },
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

  const handlePhoneCall = () => {
    const phoneNumber = activeTrip?.passenger_phone || '';
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleSendSMS = () => {
    const phoneNumber = activeTrip?.passenger_phone || '';
    Linking.openURL(`sms:${phoneNumber}`);
  };

  const animatePress = (pressed: boolean) => {
    Animated.spring(scaleAnim, {
      toValue: pressed ? 0.95 : 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.container}>
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
              strokeWidth={5}
              strokeColor="#2196F3"
              geodesic={true}
              lineCap="round"
              lineJoin="round"
              miterLimit={10}
              zIndex={2}
            />
            {!activeTrip && pendingRequests.length > 0 && (
              <>
                <Marker
                  coordinate={{
                    latitude: pendingRequests[0].origin_lat,
                    longitude: pendingRequests[0].origin_lng,
                  }}
                  title="Origen">
                  <View style={styles.markerContainer}>
                    <MapPinIcon size={24} color="#3B82F6" />
                  </View>
                </Marker>
                <Marker
                  coordinate={{
                    latitude: pendingRequests[0].destination_lat,
                    longitude: pendingRequests[0].destination_lng,
                  }}
                  title="Destino">
                  <View style={styles.markerContainer}>
                    <FlagIcon size={24} color="#22C55E" />
                  </View>
                </Marker>
              </>
            )}
            {activeTrip && (
              <>
                <Marker
                  coordinate={{
                    latitude: activeTrip.origin_lat,
                    longitude: activeTrip.origin_lng,
                  }}
                  title="Punto de recogida">
                  <View style={styles.markerContainer}>
                    <MapPinIcon size={24} color="#3B82F6" />
                  </View>
                </Marker>
                {tripPhase === 'toDestination' && (
                  <Marker
                    coordinate={{
                      latitude: activeTrip.destination_lat,
                      longitude: activeTrip.destination_lng,
                    }}
                    title="Destino">
                    <View style={styles.markerContainer}>
                      <FlagIcon size={24} color="#22C55E" />
                    </View>
                  </Marker>
                )}
              </>
            )}
          </>
        )}
      </MapView>

      {activeTrip && (
        <View style={styles.bottomTripPanel}>
          <View style={styles.tripInfoContainer}>
            <View style={styles.tripPhaseIndicator}>
              <MapPinIcon
                size={20}
                color={tripPhase === 'toPickup' ? '#3B82F6' : '#22C55E'}
              />
              <Text style={styles.tripPhaseText}>
                {tripPhase === 'toPickup' ? 'Recogida' : 'Destino'}
              </Text>
            </View>
            <Text style={styles.addressText}>
              {tripPhase === 'toPickup'
                ? activeTrip.origin
                : activeTrip.destination}
            </Text>
          </View>

          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.circleButton, styles.arrivalButton]}
              onPress={
                tripPhase === 'toPickup'
                  ? handleArrivalAtPickup
                  : handleTripCompletion
              }>
              <MapPinIcon size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.circleButton, styles.callButton]}
              onPress={handlePhoneCall}>
              <PhoneIcon size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.circleButton, styles.messageButton]}
              onPress={handleSendSMS}>
              <MessageSquareIcon size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!activeTrip && pendingRequests.length > 0 && (
        <>
          <View style={styles.topRoutePanel}>
            <View style={styles.routeHeader}>
              <Text style={styles.routeTitle}>Dirección del Cliente</Text>
              <Text style={styles.routeDistance}>
                {currentRoute?.distance || ''}
              </Text>
            </View>
            <View style={styles.routeDetails}>
              <View style={styles.routePoint}>
                <MapPinIcon size={20} color="#3B82F6" />
                <Text style={styles.routeText} numberOfLines={2}>
                  {pendingRequests[0].origin}
                </Text>
              </View>
              <View style={styles.routePoint}>
                <FlagIcon size={20} color="#22C55E" />
                <Text style={styles.routeText} numberOfLines={2}>
                  {pendingRequests[0].destination}
                </Text>
              </View>
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeInfoText}>
                {currentRoute?.duration || ''} • {currentRoute?.distance || ''}{' '}
                • Efectivo
              </Text>
            </View>
          </View>

          <View style={styles.floatingButtonsContainer}>
            <Pressable
              onPressIn={() => animatePress(true)}
              onPressOut={() => animatePress(false)}
              onPress={() =>
                handleRequestResponse(pendingRequests[0].id, 'rejected')
              }>
              <Animated.View
                style={[
                  styles.floatingButton,
                  styles.rejectButton,
                  {transform: [{scale: scaleAnim}]},
                ]}>
                <View style={styles.buttonIconContainer}>
                  <XIcon size={24} color="white" />
                </View>
              </Animated.View>
            </Pressable>

            <Pressable
              onPressIn={() => animatePress(true)}
              onPressOut={() => animatePress(false)}
              onPress={() =>
                handleRequestResponse(pendingRequests[0].id, 'accepted')
              }>
              <Animated.View
                style={[
                  styles.floatingButton,
                  styles.acceptButton,
                  {transform: [{scale: scaleAnim}]},
                ]}>
                <View style={styles.buttonIconContainer}>
                  <CheckIcon size={24} color="white" />
                </View>
              </Animated.View>
            </Pressable>
          </View>
        </>
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
    zIndex: 900,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 16,
  },
  bottomTripPanel: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripInfoContainer: {
    flex: 1,
    gap: 4,
  },
  tripPhaseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripPhaseText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  addressText: {
    fontSize: 14,
    color: '#4B5563',
    paddingLeft: 28,
  },
  topRoutePanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  routeDistance: {
    fontSize: 14,
    color: '#666',
  },
  routeDetails: {
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  routeInfo: {
    marginTop: 8,
    alignItems: 'center',
  },
  routeInfoText: {
    fontSize: 14,
    color: '#666',
  },
  floatingButtonsContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  floatingButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  buttonIconContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: 'transparent',
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  callButton: {
    backgroundColor: '#2563EB',
  },
  messageButton: {
    backgroundColor: '#7C3AED',
  },
  tripMetrics: {
    paddingLeft: 28,
    marginTop: 4,
  },
  metricText: {
    fontSize: 14,
    color: '#6B7280',
  },
  communicationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  markerContainer: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  arrivalButton: {
    backgroundColor: '#059669',
  },
});

export default DriverHomeScreen;
