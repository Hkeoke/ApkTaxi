// NotificationService.js
import notifee, {AndroidImportance, EventType} from '@notifee/react-native';
import {tripRequestService} from './api';

class NotificationService {
  static pollingInterval = null;

  static async createNotificationChannel() {
    return await notifee.createChannel({
      id: 'trip_requests',
      name: 'Solicitudes de Viaje',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
      lights: true,
    });
  }

  static async checkNotificationPermission() {
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= 1;
  }

  // Método para iniciar el servicio de notificaciones
  static async startNotificationService(driverId) {
    try {
      // Verificar permisos
      const hasPermission = await this.checkNotificationPermission();
      if (!hasPermission) {
        console.log('No notification permissions');
        return;
      }

      // Crear canal
      await this.createNotificationChannel();

      // Iniciar polling de solicitudes
      this.startPolling(driverId);

      // Configurar manejador en background
      this.setupBackgroundHandler();
    } catch (error) {
      console.error('Error starting notification service:', error);
    }
  }

  // Método para detener el servicio
  static stopNotificationService() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // Método para hacer polling de solicitudes
  static startPolling(driverId) {
    // Limpiar intervalo existente si hay uno
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Hacer la primera verificación inmediatamente
    this.checkForNewRequests(driverId);

    // Configurar el intervalo de polling (cada 10 segundos)
    this.pollingInterval = setInterval(() => {
      this.checkForNewRequests(driverId);
    }, 10000);
  }

  // Método para verificar nuevas solicitudes
  static async checkForNewRequests(driverId) {
    try {
      const requests = await tripRequestService.getDriverPendingRequests(
        driverId,
      );

      // Mostrar notificación para cada solicitud pendiente
      for (const request of requests) {
        await this.displayNotification({
          id: request.id,
          origin: request.origin,
          destination: request.destination,
          price: request.price,
          operator: request.operator_profiles?.first_name,
        });
      }
    } catch (error) {
      console.error('Error checking for new requests:', error);
    }
  }

  // Método para mostrar notificaciones
  static async displayNotification(request) {
    try {
      const channelId = await this.createNotificationChannel();
      const notificationId = `trip_request_${request.id}_${Date.now()}`;

      await notifee.displayNotification({
        id: notificationId,
        title: '¡Nueva solicitud de viaje! 🚖',
        body: `Origen: ${request.origin}\nDestino: ${request.destination}\nPrecio: $${request.price}\nOperador: ${request.operator}`,
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          sound: 'default',
          pressAction: {
            id: 'default',
          },
          actions: [
            {
              title: 'Aceptar',
              pressAction: {
                id: 'accept',
              },
            },
            {
              title: 'Rechazar',
              pressAction: {
                id: 'reject',
              },
            },
          ],
        },
        data: {
          requestId: request.id,
          type: 'trip_request',
        },
      });

      return notificationId;
    } catch (error) {
      console.error('Error displaying notification:', error);
    }
  }

  static async setupBackgroundHandler() {
    notifee.onBackgroundEvent(async ({type, detail}) => {
      const {notification, pressAction} = detail;

      if (type === EventType.ACTION_PRESS && pressAction) {
        const requestId = notification?.data?.requestId;

        if (!requestId) return;

        try {
          if (pressAction.id === 'accept') {
            await tripRequestService.updateRequestStatus(requestId, 'accepted');
            await tripRequestService.convertRequestToTrip(requestId);
          } else if (pressAction.id === 'reject') {
            await tripRequestService.updateRequestStatus(requestId, 'rejected');
          }

          // Cancelar la notificación después de la acción
          await notifee.cancelNotification(notification.id);
        } catch (error) {
          console.error('Error handling background action:', error);
        }
      }
    });
  }
}

export default NotificationService;
