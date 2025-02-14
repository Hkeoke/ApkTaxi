// backgroundService.js
import PushNotification from 'react-native-push-notification';
import BackgroundService from 'react-native-background-actions';
import {tripRequestService} from './api';

let isServiceRunning = false;
let previousRequests = [];

const sleep = time => new Promise(resolve => setTimeout(() => resolve(), time));

const backgroundTask = async taskData => {
  const {userId} = taskData;

  while (BackgroundService.isRunning()) {
    try {
      // Verificar si hay conexión a internet antes de hacer la petición
      const requests = await tripRequestService.getDriverPendingRequests(
        userId,
      );

      // Solo procesar si hay nuevas solicitudes
      if (requests && Array.isArray(requests)) {
        const newRequests = requests.filter(
          newReq => !previousRequests.some(oldReq => oldReq.id === newReq.id),
        );

        if (newRequests.length > 0) {
          newRequests.forEach(request => {
            PushNotification.localNotification({
              channelId: 'trip-requests',
              title: 'Nueva solicitud de viaje',
              message: `Origen: ${request.origin || ''}\nDestino: ${
                request.destination || ''
              }`,
              priority: 'high',
              vibrate: true,
              playSound: true,
            });
          });
        }

        previousRequests = requests;
      }
    } catch (error) {
      console.log('Error en background service:', error);
    }

    await sleep(15000); // Aumentamos el intervalo a 15 segundos
  }
};

const options = {
  taskName: 'TripRequests',
  taskTitle: 'Buscando viajes',
  taskDesc: 'Activo',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#ff00ff',
  parameters: {
    delay: 15000,
  },
};

export const startBackgroundService = async userId => {
  if (isServiceRunning) return;

  try {
    PushNotification.configure({
      onNotification: function (notification) {
        console.log('NOTIFICATION:', notification);
      },
      popInitialNotification: true,
      requestPermissions: true,
    });

    // Crear canal de notificaciones
    PushNotification.createChannel(
      {
        channelId: 'trip-requests',
        channelName: 'Trip Requests',
        channelDescription: 'Notificaciones de viajes',
        playSound: true,
        soundName: 'default',
        importance: 4,
        vibrate: true,
      },
      created => console.log(`Canal creado: ${created}`),
    );

    await BackgroundService.start(
      taskData => backgroundTask({userId, ...taskData}),
      options,
    );
    isServiceRunning = true;
  } catch (error) {
    console.log('Error al iniciar background service:', error);
    isServiceRunning = false;
  }
};

export const stopBackgroundService = async () => {
  try {
    await BackgroundService.stop();
    isServiceRunning = false;
    previousRequests = [];
  } catch (error) {
    console.log('Error al detener background service:', error);
  }
};
