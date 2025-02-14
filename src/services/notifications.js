import notifee, {AndroidImportance, EventType} from '@notifee/react-native';
import {AppRegistry} from 'react-native';

class NotificationService {
  static async createNotificationChannel() {
    return await notifee.createChannel({
      id: 'trip_requests',
      name: 'Solicitudes de Viaje',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
      lights: true,
      // Removemos la configuración de lights completamente
    });
  }

  static async checkNotificationPermission() {
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= 1;
  }

  static async scheduleNotification(request) {
    try {
      const hasPermission = await this.checkNotificationPermission();
      if (!hasPermission) {
        console.log('No notification permissions');
        return;
      }

      const channelId = await this.createNotificationChannel();
      const notificationId = `trip_request_${request.id}_${Date.now()}`;

      await notifee.displayNotification({
        id: notificationId,
        title: '¡Nueva solicitud de viaje! 🚖',
        body: `Origen: ${request.origin}\nDestino: ${request.destination}\nPrecio: $${request.price}`,
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          sound: 'default',
          smallIcon: 'ic_launcher',
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
      console.error('Error scheduling notification:', error);
      throw error;
    }
  }

  static async cancelAllNotifications() {
    try {
      await notifee.cancelAllNotifications();
    } catch (error) {
      console.error('Error canceling notifications:', error);
    }
  }

  static async cancelNotificationsByRequestId(requestId) {
    try {
      const notifications = await notifee.getDisplayedNotifications();
      for (const notification of notifications) {
        if (notification.notification.data?.requestId === requestId) {
          await notifee.cancelNotification(notification.notification.id);
        }
      }
    } catch (error) {
      console.error('Error canceling specific notification:', error);
    }
  }
  static async setupBackgroundHandler() {
    // Registrar el manejador de eventos en background
    notifee.onBackgroundEvent(async ({type, detail}) => {
      const {notification, pressAction} = detail;

      if (type === EventType.PRESS) {
        // Manejar cuando el usuario presiona la notificación en background
        console.log('User pressed notification in background', notification);
      }

      if (type === EventType.ACTION_PRESS && pressAction) {
        const requestId = notification?.data?.requestId;

        if (!requestId) return;

        switch (pressAction.id) {
          case 'accept':
            // Manejar aceptación en background
            await handleBackgroundAccept(requestId);
            break;
          case 'reject':
            // Manejar rechazo en background
            await handleBackgroundReject(requestId);
            break;
        }

        // Cancelar la notificación después de la acción
        await notifee.cancelNotification(notification.id);
      }
    });
  }

  static async scheduleNotification(request) {
    try {
      const hasPermission = await this.checkNotificationPermission();
      if (!hasPermission) {
        console.log('No notification permissions');
        return;
      }

      const channelId = await this.createNotificationChannel();
      const notificationId = `trip_request_${request.id}_${Date.now()}`;

      await notifee.displayNotification({
        id: notificationId,
        title: '¡Nueva solicitud de viaje! 🚖',
        body: `Origen: ${request.origin}\nDestino: ${request.destination}\nPrecio: $${request.price}`,
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          sound: 'default',
          smallIcon: 'ic_launcher',
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
          // Agregar estas propiedades para notificaciones en background
          ongoing: true,
          autoCancel: false,
          timestamp: Date.now(),
          showTimestamp: true,
        },
        data: {
          requestId: request.id,
          type: 'trip_request',
          origin: request.origin,
          destination: request.destination,
          price: request.price.toString(),
        },
      });

      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      throw error;
    }
  }
}

// Funciones auxiliares para manejar acciones en background
async function handleBackgroundAccept(requestId) {
  try {
    // Aquí deberías hacer la llamada a tu API de Supabase
    // Puedes usar fetch o tu cliente de Supabase
    const response = await fetch('TU_URL_SUPABASE/trip-requests/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Incluye aquí tus headers de autenticación de Supabase
      },
      body: JSON.stringify({
        requestId,
        status: 'accepted',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to accept request');
    }
  } catch (error) {
    console.error('Error in background accept:', error);
  }
}

async function handleBackgroundReject(requestId) {
  try {
    // Similar al accept, pero para rechazar
    const response = await fetch('TU_URL_SUPABASE/trip-requests/reject', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Incluye aquí tus headers de autenticación de Supabase
      },
      body: JSON.stringify({
        requestId,
        status: 'rejected',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to reject request');
    }
  } catch (error) {
    console.error('Error in background reject:', error);
  }
}

export default NotificationService;
