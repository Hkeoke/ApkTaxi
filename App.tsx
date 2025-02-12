import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider, useAuthContext} from './src/contexts/AuthContext';
import {Truck, Users, ClipboardList} from 'lucide-react-native';

// Screens de Autenticación
import LoginScreen from './src/screens/LoginScreen';
import AdminScreen from './src/screens/AdminScreen';
//import RegisterScreen from './src/screens/auth/RegisterScreen';

// Screens para Choferes
import DriverHomeScreen from './src/screens/DriverScreen';
import OperatorHomeScreen from './src/screens/OperatorScreen';
//import DriverTripsScreen from './src/screens/driver/TripsScreen';
//import DriverProfileScreen from './src/screens/driver/ProfileScreen';

// Screens para Operadores
//import OperatorHomeScreen from './src/screens/operator/HomeScreen';
//import OperatorTripsScreen from './src/screens/operator/TripsScreen';
//import OperatorProfileScreen from './src/screens/operator/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
function AdminTabs() {
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
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {backgroundColor: '#ffffff'},
        tabBarActiveTintColor: '#0891b2',
        tabBarInactiveTintColor: '#64748b',
      }}>
      <Tab.Screen
        name="OperatorHome"
        component={OperatorHomeScreen}
        options={{
          title: 'Inicio',
          tabBarIcon: ({color, size}) => <Users color={color} size={size} />,
        }}
      />
      {/*<Tab.Screen
        name="OperatorTrips"
        component={OperatorTripsScreen}
        options={{
          title: 'Viajes',
          tabBarIcon: ({ color, size }) => (
            <ClipboardList color={color} size={size} />
          ),
        }}
      />*/}
      {/*<Tab.Screen
        name="OperatorProfile"
        component={OperatorProfileScreen}
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />*/}
    </Tab.Navigator>
  );
}

function NavigationStack() {
  const {user, loading} = useAuthContext();

  if (loading) {
    return null; // O un componente de loading
  }

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {!user ? (
        // Auth Stack
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          {/*<Stack.Screen name="Register" component={RegisterScreen} />*/}
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
            <Stack.Screen name="AdminTabs" component={AdminTabs} />
          )}
        </>
      )}
    </Stack.Navigator>
  );
}

function App(): React.JSX.Element {
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
