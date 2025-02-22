import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider, useAuthContext} from './src/contexts/AuthContext';
import {Truck, Users, ClipboardList} from 'lucide-react-native';

// Screens de Autenticación
import LoginScreen from './src/screens/LoginScreen';
import AdminScreen from './src/screens/AdminScreen';

// Screens para Choferes
import DriverHomeScreen from './src/screens/DriverScreen';
import OperatorHomeScreen from './src/screens/OperatorScreen';
import {PermissionsAndroid, Platform} from 'react-native';
import {View} from 'react-native';
import {Text} from 'react-native';
import {useEffect, useState} from 'react';
import OperatorTripsScreen from './src/screens/OperatorTripsScreen';
import DriversListScreen from './src/screens/DriversListScreen';
import DriverManagementScreen from './src/screens/DriverManagementScreen';
import OperatorManagementScreen from './src/screens/OperatorManagementScreen';
import CreateDriverScreen from './src/screens/CreateDriverScreen';
import DriverTripsAnalytics from './src/screens/DriverTripsAnalytics';
import DriverMapScreen from './src/screens/DriverMapScreen';
import EditDriverScreen from './src/screens/EditDriverScreen';
import DriverReportsScreen from './src/screens/DriverReportsScreen';
import CreateOperatorScreen from './src/screens/CreateOperatorScreen';
import OperatorsListScreen from './src/screens/OperatorsListScreen';
import OperatorReportsScreen from './src/screens/OperatorReportsScreen';
import GeneralReportsScreen from './src/screens/GeneralReportsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
function AdminTabs() {
  const {user} = useAuthContext();
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {backgroundColor: '#ffffff'},
        tabBarActiveTintColor: '#0891b2',
        tabBarInactiveTintColor: '#64748b',
      }}>
      <Tab.Screen
        name="AdminHome"
        component={AdminScreen}
        options={{
          title: 'Panel Admin',
          tabBarIcon: ({color, size}) => <Users color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
function DriverTabs() {
  const {user} = useAuthContext();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarStyle: {backgroundColor: '#ffffff'},
        tabBarActiveTintColor: '#0891b2',
        tabBarInactiveTintColor: '#64748b',
      }}>
      {
        <Tab.Screen
          name="DriverHome"
          options={{
            title: 'Inicio',
            tabBarIcon: ({color, size}) => <Truck color={color} size={size} />,
          }}>
          {() => <DriverHomeScreen user={user} />}
        </Tab.Screen>
      }
      {/* <Tab.Screen
        name="DriverTrips"
        component={DriverTripsScreen}
        options={{
          title: 'Mis Viajes',
          tabBarIcon: ({color, size}) => (
            <ClipboardList color={color} size={size} />
          ),
        }}
      />*/}
      {/*<Tab.Screen
        name="DriverProfile"
        component={DriverProfileScreen}
        options={{
          title: 'Perfil',
          tabBarIcon: ({color, size}) => <Users color={color} size={size} />,
        }}
      />*/}
    </Tab.Navigator>
  );
}

function OperatorTabs() {
  const {user} = useAuthContext();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarStyle: {backgroundColor: '#ffffff'},
        tabBarActiveTintColor: '#0891b2',
        tabBarInactiveTintColor: '#64748b',
      }}>
      <Tab.Screen
        name="OperatorHome"
        component={() => <OperatorHomeScreen user={user} />}
        options={{
          title: 'Panel',
          tabBarIcon: ({color, size}) => <Users color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="OperatorTrips"
        component={() => <OperatorTripsScreen user={user} />}
        options={{
          title: 'Viajes',
          tabBarIcon: ({color, size}) => (
            <ClipboardList color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function NavigationStack() {
  const {user, loading} = useAuthContext();

  if (loading) {
    return null;
  }

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {!user ? (
        // Auth Stack
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
        </>
      ) : (
        // App Stacks según el rol
        <>
          {user.role === 'chofer' && (
            <Stack.Screen name="DriverTabs" component={DriverTabs} />
          )}
          {user.role === 'operador' && (
            <Stack.Screen name="OperatorTabs" component={OperatorTabs} />
          )}
          {user.role === 'admin' && (
            <>
              <Stack.Screen name="AdminTabs" component={AdminTabs} />
              <Stack.Screen
                name="OperatorScreen"
                component={({route}: {route: any}) => (
                  <OperatorHomeScreen
                    user={user}
                    role="admin"
                    mode={route.params?.mode || 'normal'}
                  />
                )}
                options={{
                  headerShown: true,
                  title: 'Solicitud de viajes',
                }}
              />
              <Stack.Screen
                name="DriversListScreen"
                component={DriversListScreen}
                options={{
                  headerShown: true,
                  title: 'Lista de Choferes',
                }}
              />
              <Stack.Screen
                name="DriverManagementScreen"
                component={DriverManagementScreen}
                options={{
                  headerShown: true,
                  title: 'Gestión de Choferes',
                }}
              />
              <Stack.Screen
                name="CreateDriverScreen"
                component={CreateDriverScreen}
                options={{
                  headerShown: true,
                  title: 'Crear Chofer',
                }}
              />
              <Stack.Screen
                name="OperatorManagementScreen"
                component={OperatorManagementScreen}
                options={{
                  headerShown: true,
                  title: 'Gestión de Operadores',
                }}
              />
              <Stack.Screen
                name="DriverTripsAnalytics"
                component={DriverTripsAnalytics}
                options={{
                  headerShown: true,
                  title: 'Estadísticas de Viajes',
                }}
              />
              <Stack.Screen
                name="DriverMapScreen"
                component={DriverMapScreen}
                options={{
                  headerShown: true,
                  title: 'Mapa de Choferes',
                }}
              />
              <Stack.Screen
                name="EditDriver"
                component={EditDriverScreen}
                options={{
                  headerShown: true,
                  title: 'Editar Chofer',
                }}
              />
              <Stack.Screen
                name="DriverReports"
                component={DriverReportsScreen}
                options={{
                  headerShown: true,
                  title: 'Reportes de Viajes',
                }}
              />
              <Stack.Screen
                name="CreateOperatorScreen"
                component={CreateOperatorScreen}
                options={{
                  headerShown: true,
                  title: 'Crear Operador',
                }}
              />
              <Stack.Screen
                name="OperatorsListScreen"
                component={OperatorsListScreen}
                options={{
                  headerShown: true,
                  title: 'Lista de Operadores',
                }}
              />
              <Stack.Screen
                name="OperatorReports"
                component={OperatorReportsScreen}
                options={{
                  headerShown: true,
                  title: 'Reportes de Operadores',
                }}
              />
              <Stack.Screen
                name="GeneralReportsScreen"
                component={GeneralReportsScreen}
                options={{
                  headerShown: true,
                  title: 'Reportes Generales',
                }}
              />
            </>
          )}
        </>
      )}
    </Stack.Navigator>
  );
}

function App(): React.JSX.Element {
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        if (Platform.OS === 'android') {
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

          setIsPermissionGranted(
            granted === PermissionsAndroid.RESULTS.GRANTED,
          );
        } else {
          // Manejar permisos para iOS si es necesario

          setIsPermissionGranted(true);
        }
      } catch (err) {
        console.warn(err);
      } finally {
        setLoading(false);
      }
    };

    checkPermissions();
  }, []);

  if (loading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <Text>Cargando...</Text>
      </View>
    );
  }

  if (!isPermissionGranted) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <Text>Se requiere permiso de ubicación para usar la aplicación</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <NavigationStack />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
export default App;
