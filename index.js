/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

import NotificationService from './src/services/notifications';

// Configurar el manejador de eventos en background
NotificationService.setupBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
