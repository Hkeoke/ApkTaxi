// NotificationService.js
/*import notifee, {
  AndroidImportance,
  EventType,
  AndroidVisibility,
} from '@notifee/react-native';
import {AppState} from 'react-native';
import {tripRequestService, driverService} from './api';

class NotificationService {
  static pollingInterval = null;
  static appStateSubscription = null;

  static async createNotificationChannel() {
    return await notifee.createChannel({
      id: 'trip_requests',
      name: 'Solicitudes de Viaje',
      importance: AndroidImportance.HIGH,
      sound: 'notification', // Asegúrate de que este sonido existe
      vibration: true,
      lights: true,
      vibrationPattern: [300, 500],
      visibility: AndroidVisibility.PUBLIC,
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

  static async setupForegroundHandler() {
    return notifee.onForegroundEvent(({type, detail}) => {
      const {notification, pressAction} = detail;

      if (type === EventType.ACTION_PRESS && notification?.data) {
        const requestId = notification.data.requestId;

        if (pressAction?.id === 'accept') {
          tripRequestService.updateRequestStatus(requestId, 'accepted');
          tripRequestService.convertRequestToTrip(requestId);
        } else if (pressAction?.id === 'reject') {
          tripRequestService.updateRequestStatus(requestId, 'rejected');
        }

        // Cancelar la notificación después de la acción
        notifee.cancelNotification(notification.id);
      }
    });
  }

  static async setupBackgroundHandler() {
    return notifee.onBackgroundEvent(async ({type, detail}) => {
      const {notification, pressAction} = detail;

      if (type === EventType.ACTION_PRESS && notification?.data) {
        const requestId = notification.data.requestId;

        if (pressAction?.id === 'accept') {
          await tripRequestService.updateRequestStatus(requestId, 'accepted');
          await tripRequestService.convertRequestToTrip(requestId);
        } else if (pressAction?.id === 'reject') {
          await tripRequestService.updateRequestStatus(requestId, 'rejected');
        }

        // Cancelar la notificación después de la acción
        await notifee.cancelNotification(notification.id);
      }
    });
  }

  static async setupAppStateHandler(driverId) {
    // Manejar cambios en el estado de la aplicación
    this.appStateSubscription = AppState.addEventListener(
      'change',
      nextAppState => {
        if (nextAppState === 'active') {
          // La app vuelve a primer plano
          this.startNotificationService(driverId);
        } else if (nextAppState === 'background') {
          // La app va a segundo plano
          // Mantenemos el servicio activo pero ajustamos el intervalo
          if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = setInterval(() => {
              this.checkForNewRequests(driverId);
            }, 30000); // Aumentamos el intervalo en segundo plano
          }
        }
      },
    );
  }

  static async startNotificationService(driverId) {
    try {
      if (!driverId) {
        console.error('driverId es requerido para iniciar el servicio');
        return;
      }

      console.log('Iniciando servicio de notificaciones para:', driverId);

      const driverProfile = await driverService.getDriverProfile(driverId);
      if (!driverProfile?.is_on_duty) {
        console.log(
          'Conductor no está en servicio, no se inician notificaciones',
        );
        return;
      }

      const hasPermission = await this.checkNotificationPermission();
      if (!hasPermission) {
        console.error('No hay permisos de notificación');
        return;
      }

      // Detener cualquier servicio existente antes de iniciar uno nuevo
      await this.stopNotificationService();

      await this.createNotificationChannel();
      await this.setupForegroundHandler();
      await this.setupBackgroundHandler();
      await this.setupAppStateHandler(driverId);

      // Verificar solicitudes inmediatamente
      await this.checkForNewRequests(driverId);

      // Iniciar el polling
      this.pollingInterval = setInterval(() => {
        this.checkForNewRequests(driverId);
      }, 10000);

      console.log('Servicio de notificaciones iniciado exitosamente');
    } catch (error) {
      console.error('Error al iniciar servicio de notificaciones:', error);
    }
  }

  static async checkForNewRequests(driverId) {
    try {
      // Verificar si el driverId es válido
      if (!driverId) {
        console.error('driverId no válido');
        return;
      }

      const driverProfile = await driverService.getDriverProfile(driverId);

      if (!driverProfile) {
        console.error('No se pudo obtener el perfil del conductor');
        return;
      }

      if (!driverProfile.is_on_duty) {
        console.log('Conductor fuera de servicio, deteniendo notificaciones');
        await this.stopNotificationService();
        return;
      }

      console.log('Verificando solicitudes para:', driverId);
      console.log('Tipo de vehículo:', driverProfile.vehicle_type);

      const requests = await tripRequestService.getDriverPendingRequests(
        driverId,
        driverProfile.vehicle_type,
      );

      if (requests && requests.length > 0) {
        console.log(
          `Encontradas ${requests.length} solicitudes pendientes:`,
          requests,
        );
        for (const request of requests) {
          // Verificar si ya existe una notificación para esta solicitud
          const existingNotifications =
            await notifee.getDisplayedNotifications();
          const notificationExists = existingNotifications.some(
            n => n.id === `trip_request_${request.id}`,
          );

          if (!notificationExists) {
            await this.displayNotification(request);
          }
        }
      }
    } catch (error) {
      console.error('Error al verificar solicitudes:', error);
    }
  }

  static async displayNotification(request) {
    try {
      if (!request || !request.id) {
        console.error('Solicitud inválida:', request);
        return;
      }

      const channelId = await this.createNotificationChannel();

      // Formatear el precio correctamente
      const formattedPrice =
        typeof request.price === 'number'
          ? request.price.toFixed(2)
          : request.price;

      const notificationId = `trip_request_${request.id}`;

      console.log('Mostrando notificación:', {
        id: notificationId,
        request: request,
      });

      await notifee.displayNotification({
        id: notificationId,
        title: '¡Nueva solicitud de viaje! 🚖',
        body: `Origen: ${request.origin}\nDestino: ${request.destination}\nPrecio: $${formattedPrice}`,
        android: {
          channelId,
          pressAction: {
            id: 'default',
          },
          actions: [
            {
              title: '✅ Aceptar',
              pressAction: {
                id: 'accept',
              },
            },
            {
              title: '❌ Rechazar',
              pressAction: {
                id: 'reject',
              },
            },
          ],
          smallIcon: 'ic_notification', // Asegúrate de que este icono existe
          importance: AndroidImportance.HIGH,
          sound: 'notification',
          vibrationPattern: [300, 500],
        },
        data: {
          requestId: request.id,
          type: 'trip_request',
        },
      });
    } catch (error) {
      console.error('Error al mostrar notificación:', error);
    }
  }

  static async stopNotificationService() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    console.log('Servicio de notificaciones detenido');
  }
}

export default NotificationService;*/
