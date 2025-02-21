// NotificationService.js
import notifee, {AndroidImportance, EventType} from '@notifee/react-native';
import {AppState} from 'react-native';
import {tripRequestService} from './api';

class NotificationService {
  static pollingInterval = null;
  static appStateSubscription = null;

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
    if (settings.authorizationStatus < 1) {
      console.log('No se tienen permisos de notificación');
      return false;
    }
    return true;
  }

  static async startNotificationService(driverId) {
    try {
      if (!driverId) {
        console.error('No se proporcionó ID del chofer');
        return;
      }

      const hasPermission = await this.checkNotificationPermission();
      if (!hasPermission) {
        console.error('No hay permisos de notificación');
        return;
      }

      await this.createNotificationChannel();

      // Verificar si ya hay un polling activo
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
      }

      // Hacer la primera verificación inmediatamente
      await this.checkForNewRequests(driverId);

      // Iniciar polling
      this.startPolling(driverId);

      // Configurar AppState
      this.setupAppStateListener(driverId);

      console.log('Servicio de notificaciones iniciado para chofer:', driverId);
    } catch (error) {
      console.error('Error al iniciar servicio de notificaciones:', error);
    }
  }

  static async checkForNewRequests(driverId) {
    try {
      if (!driverId) {
        console.error('ID de chofer no válido');
        return;
      }

      console.log('Verificando solicitudes cercanas para chofer:', driverId);
      const requests = await tripRequestService.getDriverPendingRequests(
        driverId,
      );

      if (!requests || requests.length === 0) {
        console.log('No hay nuevas solicitudes cercanas');
        return;
      }

      console.log(`Se encontraron ${requests.length} solicitudes cercanas`);

      for (const request of requests) {
        if (request.distance <= request.search_radius) {
          await this.displayNotification(request);
          console.log('Notificación enviada para solicitud:', request.id);
        }
      }
    } catch (error) {
      console.error('Error al verificar nuevas solicitudes:', error);
    }
  }

  static async displayNotification(request) {
    try {
      if (!request || !request.id) {
        console.error('Datos de solicitud inválidos');
        return;
      }

      const channelId = await this.createNotificationChannel();
      const notificationId = `trip_request_${request.id}_${Date.now()}`;

      const distanceText =
        request.distance >= 1000
          ? `${(request.distance / 1000).toFixed(1)} km`
          : `${Math.round(request.distance)} m`;

      await notifee.displayNotification({
        id: notificationId,
        title: '¡Nueva solicitud de viaje! 🚖',
        body: `Origen: ${request.origin}\nDestino: ${request.destination}\nPrecio: $${request.price}\nDistancia: ${distanceText}\nOperador: ${request.operator_profiles?.first_name}`,
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
      console.error('Error al mostrar notificación:', error);
    }
  }

  static setupAppStateListener(driverId) {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    this.appStateSubscription = AppState.addEventListener(
      'change',
      nextAppState => {
        console.log('Estado de la app cambió a:', nextAppState);

        if (nextAppState === 'active') {
          console.log('App en primer plano - reiniciando polling');
          this.startPolling(driverId);
        } else if (nextAppState === 'background') {
          console.log('App en segundo plano - ajustando intervalo');
          this.adjustPollingInterval(driverId, 30000);
        }
      },
    );
  }

  static startPolling(driverId) {
    this.adjustPollingInterval(driverId, 10000); // 10 segundos en primer plano
  }

  static adjustPollingInterval(driverId, interval) {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(() => {
      this.checkForNewRequests(driverId);
    }, interval);
  }

  static async stopNotificationService() {
    try {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }

      if (this.appStateSubscription) {
        this.appStateSubscription.remove();
        this.appStateSubscription = null;
      }

      console.log('Servicio de notificaciones detenido');
    } catch (error) {
      console.error('Error al detener servicio de notificaciones:', error);
    }
  }

  static async setupBackgroundHandler() {
    return notifee.onBackgroundEvent(async ({type, detail}) => {
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
