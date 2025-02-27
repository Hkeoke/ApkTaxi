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
  Image,
  AppState,
  AppStateStatus,
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
import notifee, {AndroidImportance} from '@notifee/react-native';
import Sound from 'react-native-sound';
import BackgroundService from 'react-native-background-actions';

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
  passenger_phone: string;
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
  const [rejectedRequests, setRejectedRequests] = useState<string[]>([]);
  const [sound, setSound] = useState<Sound | null>(null);
  const [notificationId, setNotificationId] = useState<string | null>(null);

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

  const setupSound = () => {
    Sound.setCategory('Playback');
    const newSound = new Sound(
      'notification_sound.mp3',
      Sound.MAIN_BUNDLE,
      error => {
        if (error) {
          console.error('Error loading sound:', error);
          return;
        }
        newSound.setNumberOfLoops(-1); // Reproducir en loop
      },
    );
    setSound(newSound);
  };

  const showNotification = async (request: TripRequest) => {
    try {
      // Crear canal para Android
      const channelId = await notifee.createChannel({
        id: 'trip_requests',
        name: 'Solicitudes de Viaje',
        importance: AndroidImportance.HIGH,
        sound: 'notification_sound',
      });

      // Mostrar la notificación
      const id = await notifee.displayNotification({
        title: '¡Nueva solicitud de viaje!',
        body: `Origen: ${request.origin}\nDestino: ${request.destination}`,
        android: {
          channelId,
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

      setNotificationId(id);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  const stopAlerts = async () => {
    if (sound) {
      sound.stop();
    }
    if (notificationId) {
      await notifee.cancelNotification(notificationId);
      setNotificationId(null);
    }
  };

  const fetchPendingRequests = async () => {
    if (!position || !isOnDuty) return;

    if (pendingRequests.length === 0 && !activeTrip) {
      try {
        const requests = await tripRequestService.getDriverPendingRequests(
          user.id,
          user.driver_profiles.vehicle_type,
        );

        const filteredRequests = requests.filter(
          req => !rejectedRequests.includes(req.id),
        );

        if (filteredRequests.length > 0) {
          showNotification(filteredRequests[0]);
          sound?.play();

          const route = await calculateRoute(
            {
              latitude: filteredRequests[0].origin_lat,
              longitude: filteredRequests[0].origin_lng,
            },
            {
              latitude: filteredRequests[0].destination_lat,
              longitude: filteredRequests[0].destination_lng,
            },
          );
          setCurrentRoute(route);

          if (mapRef.current) {
            const coordinates = [
              {
                latitude: filteredRequests[0].origin_lat,
                longitude: filteredRequests[0].origin_lng,
              },
              ...route.polyline,
              {
                latitude: filteredRequests[0].destination_lat,
                longitude: filteredRequests[0].destination_lng,
              },
            ];

            mapRef.current?.fitToCoordinates(coordinates, {
              edgePadding: {top: 50, right: 50, bottom: 50, left: 50},
              animated: true,
            });
          }
        }

        setPendingRequests(filteredRequests);
      } catch (error) {
        console.error('Error al obtener solicitudes:', error);
      }
    }
  };

  const sleep = (time: number) =>
    new Promise(resolve => setTimeout(resolve, time));

  const backgroundTask = async () => {
    try {
      await new Promise(async resolve => {
        await BackgroundService.updateNotification({
          taskDesc: 'Servicio activo',
        });

        while (BackgroundService.isRunning()) {
          try {
            if (isOnDuty) {
              await fetchPendingRequests();

              // Actualizar la notificación periódicamente
              await BackgroundService.updateNotification({
                taskDesc:
                  'Última actualización: ' + new Date().toLocaleTimeString(),
              });
            }
          } catch (error) {
            console.error('Error in background task:', error);
            // Continuar ejecutando incluso si hay error
          }
          await sleep(10000);
        }
      });
    } catch (error) {
      console.error('Background task error:', error);
      // Intentar reiniciar el servicio si falla
      startBackgroundService();
    }
  };

  const startBackgroundService = async () => {
    const options = {
      taskName: 'CheckTrips',
      taskTitle: 'Buscando viajes',
      taskDesc: 'Iniciando servicio...',
      taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
      },
      color: '#0891b2',
      parameters: {
        delay: 10000,
      },
      // Opciones adicionales para mejorar la estabilidad
      progressBar: {
        max: 100,
        indeterminate: true,
      },
      stopOnTerminate: false, // Continuar después de que la app se cierre
      allowExecutionInForeground: true,
    };

    try {
      if (await BackgroundService.isRunning()) {
        await BackgroundService.stop();
      }
      await BackgroundService.start(backgroundTask, options);
      console.log('Servicio en segundo plano iniciado');
    } catch (error) {
      console.error('Error starting background service:', error);
      Alert.alert('Error', 'No se pudo iniciar el servicio en segundo plano');
    }
  };

  const stopBackgroundService = async () => {
    try {
      if (await BackgroundService.isRunning()) {
        await BackgroundService.stop();
      }
    } catch (error) {
      console.error('Error stopping background service:', error);
    }
  };

  // Modificar el efecto para ser más resiliente
  useEffect(() => {
    let isSubscribed = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    const handleBackgroundService = async () => {
      try {
        if (isOnDuty && position && isSubscribed) {
          await startBackgroundService();
        } else if (isSubscribed) {
          await stopBackgroundService();
        }
      } catch (error) {
        console.error('Error handling background service:', error);
        // Reintentar si falla
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          setTimeout(handleBackgroundService, 1000 * retryCount);
        }
      }
    };

    handleBackgroundService();

    // Agregar un listener para cuando la app vuelve a primer plano
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && isOnDuty) {
        handleBackgroundService();
      }
    });

    return () => {
      isSubscribed = false;
      subscription.remove();
      stopBackgroundService();
    };
  }, [isOnDuty, position]);

  const handleRequestResponse = async (
    requestId: string,
    status: 'accepted' | 'rejected',
  ) => {
    try {
      // Detener sonido y notificación
      await stopAlerts();

      if (status === 'rejected') {
        setRejectedRequests(prev => [...prev, requestId]);
        setPendingRequests([]);
      }

      if (status === 'accepted') {
        await tripRequestService.updateRequestStatus(requestId, status);
        await tripRequestService.updateTripRequest(requestId, {
          driver_id: user.id,
          status: 'accepted',
        });
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

          // Configurar la vista del mapa en modo navegación
          mapRef.current?.animateToRegion({
            latitude: position.latitude,
            longitude: position.longitude,
            latitudeDelta: 0.005, // Zoom más cercano para navegación
            longitudeDelta: 0.005,
          });

          // Rotar el mapa en la dirección del siguiente punto de la ruta
          if (route.polyline.length > 1) {
            const nextPoint = route.polyline[1];
            const bearing = calculateBearing(
              position.latitude,
              position.longitude,
              nextPoint.latitude,
              nextPoint.longitude,
            );
            mapRef.current?.animateCamera({
              center: {
                latitude: position.latitude,
                longitude: position.longitude,
              },
              pitch: 45, // Inclinar la vista para mejor visualización
              heading: bearing, // Rotar hacia la dirección de la ruta
              zoom: 18, // Zoom cercano para navegación
            });
          }
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

  // Agregar función para calcular el bearing (dirección) entre dos puntos
  const calculateBearing = (
    startLat: number,
    startLng: number,
    destLat: number,
    destLng: number,
  ) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const phi1 = toRad(startLat);
    const phi2 = toRad(destLat);
    const deltaLambda = toRad(destLng - startLng);

    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

    let bearing = Math.atan2(y, x);
    bearing = (bearing * 180) / Math.PI;
    bearing = (bearing + 360) % 360;

    return bearing;
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

      // Calcular el descuento (10% del precio del viaje)
      const commission = activeTrip.price * 0.1;

      // Primero aplicamos el descuento al balance
      await driverService.updateDriverBalance(
        user.id,
        commission,
        'descuento',
        `Comisión del viaje #${activeTrip.id}`,
        user.id,
      );

      // Luego completamos el viaje
      await tripRequestService.updateTripStatus(activeTrip.id, 'completed');

      // Resetear estados
      setActiveTrip(null);
      setTripPhase(null);
      setCurrentRoute(null);
      setPendingRequests([]);
      setRejectedRequests([]);

      Alert.alert(
        'Viaje Completado',
        `Viaje completado exitosamente.\nSe ha descontado una comisión de $${commission.toFixed(
          2,
        )}`,
      );
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
            if (mapRef.current && prev && activeTrip) {
              // Si hay un viaje activo, mantener la vista en modo navegación
              const bearing = calculateBearing(
                prev.latitude,
                prev.longitude,
                newPosition.latitude,
                newPosition.longitude,
              );

              mapRef.current.animateCamera({
                center: newPosition,
                pitch: 45,
                heading: bearing,
                zoom: 18,
              });
            } else if (mapRef.current && prev) {
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
    if (!phoneNumber) {
      Alert.alert('Error', 'No hay número de teléfono disponible');
      return;
    }
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleSendSMS = () => {
    const phoneNumber = activeTrip?.passenger_phone || '';
    if (!phoneNumber) {
      Alert.alert('Error', 'No hay número de teléfono disponible');
      return;
    }
    Linking.openURL(`sms:${phoneNumber}`);
  };

  const animatePress = (pressed: boolean) => {
    Animated.spring(scaleAnim, {
      toValue: pressed ? 0.95 : 1,
      useNativeDriver: true,
    }).start();
  };

  // Inicializar el sonido cuando se monta el componente
  useEffect(() => {
    setupSound();
    return () => {
      if (sound) {
        sound.release();
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        customMapStyle={mapStyle}
        region={position as Region}
        showsUserLocation={false}
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
                  <View style={styles.markerWrapper}>
                    <View
                      style={[
                        styles.markerContainer,
                        {borderColor: '#3B82F6'},
                      ]}>
                      <View style={styles.markerIconContainer}>
                        <MapPinIcon size={16} color="#3B82F6" />
                        <View
                          style={[
                            styles.markerPin,
                            {backgroundColor: '#3B82F6'},
                          ]}
                        />
                        <View style={styles.markerPinShadow} />
                      </View>
                    </View>
                  </View>
                </Marker>
                <Marker
                  coordinate={{
                    latitude: pendingRequests[0].destination_lat,
                    longitude: pendingRequests[0].destination_lng,
                  }}
                  title="Destino">
                  <View style={styles.markerWrapper}>
                    <View
                      style={[
                        styles.markerContainer,
                        {borderColor: '#22C55E'},
                      ]}>
                      <View style={styles.markerIconContainer}>
                        <FlagIcon size={16} color="#22C55E" />
                        <View
                          style={[
                            styles.markerPin,
                            {backgroundColor: '#22C55E'},
                          ]}
                        />
                        <View style={styles.markerPinShadow} />
                      </View>
                    </View>
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
                  <View style={styles.markerWrapper}>
                    <View
                      style={[
                        styles.markerContainer,
                        {borderColor: '#3B82F6'},
                      ]}>
                      <View style={styles.markerIconContainer}>
                        <MapPinIcon size={16} color="#3B82F6" />
                        <View
                          style={[
                            styles.markerPin,
                            {backgroundColor: '#3B82F6'},
                          ]}
                        />
                        <View style={styles.markerPinShadow} />
                      </View>
                    </View>
                  </View>
                </Marker>
                {tripPhase === 'toDestination' && (
                  <Marker
                    coordinate={{
                      latitude: activeTrip.destination_lat,
                      longitude: activeTrip.destination_lng,
                    }}
                    title="Destino">
                    <View style={styles.markerWrapper}>
                      <View
                        style={[
                          styles.markerContainer,
                          {borderColor: '#22C55E'},
                        ]}>
                        <View style={styles.markerIconContainer}>
                          <FlagIcon size={16} color="#22C55E" />
                          <View
                            style={[
                              styles.markerPin,
                              {backgroundColor: '#22C55E'},
                            ]}
                          />
                          <View style={styles.markerPinShadow} />
                        </View>
                      </View>
                    </View>
                  </Marker>
                )}
              </>
            )}
          </>
        )}
        {position && (
          <Marker
            coordinate={{
              latitude: position.latitude,
              longitude: position.longitude,
            }}
            anchor={{x: 0.5, y: 0.5}}
            rotation={
              currentRoute?.polyline.length
                ? (calculateBearing(
                    position.latitude,
                    position.longitude,
                    currentRoute.polyline[1].latitude,
                    currentRoute.polyline[1].longitude,
                  ) +
                    180) %
                  360
                : 180
            }>
            <Image
              source={require('../../assets/navegation-arrow.png')}
              style={styles.navigationArrow}
            />
          </Marker>
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
              <Text style={styles.routeTitle}>Detalles del Viaje</Text>
              <Text style={styles.routeDistance}>
                {currentRoute?.distance || ''}
              </Text>
            </View>
            <View style={styles.routeDetails}>
              <View style={styles.routePoint}>
                <MessageSquareIcon size={20} color="#6366F1" />
                <Text style={styles.routeText} numberOfLines={2}>
                  {pendingRequests[0].observations || 'Sin observaciones'}
                </Text>
              </View>
              <View style={styles.routePoint}>
                <View style={styles.priceIconContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                </View>
                <Text
                  style={[styles.routeText, styles.priceText]}
                  numberOfLines={1}>
                  {pendingRequests[0].price.toLocaleString('es-MX', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
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
  arrivalButton: {
    backgroundColor: '#059669',
  },
  navigationArrow: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  priceIconContainer: {
    width: 20,
    height: 20,
    backgroundColor: '#22C55E',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22C55E',
  },
});

export default DriverHomeScreen;
