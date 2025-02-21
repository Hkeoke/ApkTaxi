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
import {LogOut, X, User} from 'lucide-react-native';
import {useAuthContext} from '../contexts/AuthContext';

const {height} = Dimensions.get('window');

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
  role: 'chofer' | 'operador';
}

const Sidebar = ({isVisible, onClose, role}: SidebarProps) => {
  const {user, logout} = useAuthContext();

  console.log('User data in Sidebar:', user); // Para debugging

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
        <View style={styles.header}>
          <Text style={styles.title}>
            Menú {role === 'chofer' ? 'Chofer' : 'Operador'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X color="#374151" size={24} />
          </TouchableOpacity>
        </View>

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
              {role === 'chofer' ? 'Chofer' : 'Operador'}
            </Text>
          </View>

          <View style={styles.content}>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 5,
  },
  userInfo: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 8,
    textAlign: 'center',
  },
  userRole: {
    fontSize: 15,
    color: '#4b5563',
    marginTop: 4,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  userPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
    flex: 1,
    justifyContent: 'space-between',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    marginTop: 20,
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
