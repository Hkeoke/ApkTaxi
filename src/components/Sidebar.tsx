import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import {LogOut, User, Map, Users, FileText} from 'lucide-react-native';
import {useAuthContext} from '../contexts/AuthContext';
import {useNavigation, NavigationProp} from '@react-navigation/native';

const {height} = Dimensions.get('window');

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
  role: 'chofer' | 'operador' | 'admin';
}

type RootStackParamList = {
  OperatorScreen: undefined;
  DriversListScreen: undefined;
  DriverMapScreen: undefined;
  GeneralReportsScreen: undefined;
};

const Sidebar = ({isVisible, onClose, role}: SidebarProps) => {
  const {user, logout} = useAuthContext();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const slideAnim = React.useRef(new Animated.Value(-300)).current;

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isVisible ? 0 : -300,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  const handleLogout = async () => {
    try {
      await logout();
      onClose();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (!isVisible) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} />
      <Animated.View
        style={[
          styles.sidebar,
          {
            transform: [{translateX: slideAnim}],
          },
        ]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.userInfo}>
            <View style={styles.avatarContainer}>
              <User color="#0891b2" size={50} strokeWidth={1.5} />
            </View>
            {user?.role === 'chofer' && (
              <Text style={styles.userName}>
                {user?.driver_profiles?.first_name || ''}{' '}
                {user?.driver_profiles?.last_name || ''}
              </Text>
            )}
            {user?.role === 'operador' && (
              <Text style={styles.userName}>
                {user?.operator_profiles?.first_name || ''}{' '}
                {user?.operator_profiles?.last_name || ''}
              </Text>
            )}
            <Text style={styles.userRole}>
              {role === 'chofer'
                ? 'Chofer'
                : role === 'operador'
                ? 'Operador'
                : 'Administrador'}
            </Text>
          </View>

          <View style={styles.content}>
            {role === 'admin' && (
              <View style={styles.menuSection}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    navigation.navigate('DriverMapScreen');
                    onClose();
                  }}>
                  <Users color="#0891b2" size={24} />
                  <Text style={styles.menuItemText}>Ver Choferes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    navigation.navigate('OperatorScreen');
                    onClose();
                  }}>
                  <Map color="#0891b2" size={24} />
                  <Text style={styles.menuItemText}>Solicitar Viaje</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    navigation.navigate('GeneralReportsScreen');
                    onClose();
                  }}>
                  <FileText color="#0891b2" size={24} />
                  <Text style={styles.menuItemText}>Reportes Generales</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}>
              <LogOut color="#ef4444" size={24} />
              <Text style={styles.logoutText}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 280,
    height: '100%',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  userInfo: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginTop: 40,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#0891b2',
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 4,
    textAlign: 'center',
  },
  userRole: {
    fontSize: 13,
    color: '#0891b2',
    marginTop: 8,
    fontWeight: '600',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0891b2',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flex: 1,
    justifyContent: 'space-between',
  },
  menuSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 16,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    marginBottom: 8,
  },
  menuItemText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#334155',
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default Sidebar;
