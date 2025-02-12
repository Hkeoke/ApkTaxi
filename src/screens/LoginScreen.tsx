import {useState} from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Dimensions,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {Phone, Lock, LogIn} from 'lucide-react-native';
import {useAuthContext} from '../contexts/AuthContext';
import {authService} from '../services/api';

export default function LoginScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const {setUser} = useAuthContext();

  const handleLogin = async () => {
    if (!phoneNumber || !pin) {
      Alert.alert('Error', 'Por favor ingresa todos los campos');
      return;
    }

    try {
      setIsLoading(true);
      const userData = await authService.login(phoneNumber, pin);
      await setUser(userData);
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert(
        'Error',
        'Credenciales inválidas o hubo un problema al iniciar sesión',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <LogIn size={40} color="white" />
          </View>
          <Text style={styles.title}>Bienvenido</Text>
          <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Phone size={20} color="#666" />
            <TextInput
              style={styles.input}
              placeholder="Número de teléfono"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              autoCapitalize="none"
              editable={!isLoading}
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={20} color="#666" />
            <TextInput
              style={styles.input}
              placeholder="PIN"
              value={pin}
              onChangeText={setPin}
              secureTextEntry
              keyboardType="numeric"
              editable={!isLoading}
              placeholderTextColor="#666"
              maxLength={6}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}>
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Iniciar Sesión</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ¿Necesitas ayuda? Contacta a soporte
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#2563eb',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    marginTop: 24,
  },
  footerText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
});
