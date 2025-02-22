import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import {User, Phone, Truck, Bike, KeyRound} from 'lucide-react-native';
import {driverService} from '../services/api';

interface DriverForm {
  first_name: string;
  last_name: string;
  phone_number: string;
  vehicle: string;
  vehicle_type: '2_ruedas' | '4_ruedas';
  pin: string;
}

interface InputFieldProps {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  secureTextEntry?: boolean;
  maxLength?: number;
  autoCorrect?: boolean;
}

const CreateDriverScreen = ({navigation}: {navigation: any}) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<DriverForm>({
    first_name: '',
    last_name: '',
    phone_number: '',
    vehicle: '',
    vehicle_type: '4_ruedas',
    pin: '',
  });

  const handleSubmit = async () => {
    try {
      const result = await driverService.createDriver({
        first_name: form.first_name,
        last_name: form.last_name,
        phone_number: form.phone_number,
        vehicle: form.vehicle,
        vehicle_type: form.vehicle_type,
        pin: form.pin,
      });

      if (!result.success) {
        Alert.alert('Error', result.error || 'No se pudo crear el conductor');
        return;
      }

      Alert.alert('Éxito', 'Conductor creado correctamente', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error en handleSubmit:', error);
      Alert.alert('Error', 'Ocurrió un error al crear el conductor');
    }
  };

  const InputField = ({
    icon,
    label,
    required = false,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    secureTextEntry,
    maxLength,
    autoCorrect = false,
  }: InputFieldProps) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <View style={styles.inputContainer}>
        <View style={styles.iconContainer}>
          {React.cloneElement(icon as React.ReactElement, {size: 18})}
        </View>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          maxLength={maxLength}
          autoCorrect={autoCorrect}
          autoCapitalize="none"
          returnKeyType="next"
          blurOnSubmit={false}
          enablesReturnKeyAutomatically={false}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{flex: 1}}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none">
          <View style={styles.form}>
            <View style={styles.header}>
              <Text style={styles.title}>Información del Chofer</Text>
              <Text style={styles.subtitle}>
                Complete los datos para registrar un nuevo chofer
              </Text>
            </View>

            <InputField
              icon={<User size={20} color="#64748b" />}
              label="Nombre"
              required
              value={form.first_name}
              onChangeText={(text: string) =>
                setForm({...form, first_name: text})
              }
              placeholder="Ingrese el nombre"
              autoCorrect={false}
            />

            <InputField
              icon={<User size={20} color="#64748b" />}
              label="Apellidos"
              required
              value={form.last_name}
              onChangeText={(text: string) =>
                setForm({...form, last_name: text})
              }
              placeholder="Ingrese los apellidos"
              autoCorrect={false}
            />

            <InputField
              icon={<Phone size={20} color="#64748b" />}
              label="Teléfono"
              required
              value={form.phone_number}
              onChangeText={(text: string) =>
                setForm({...form, phone_number: text})
              }
              placeholder="Ingrese el número de teléfono"
              keyboardType="phone-pad"
            />

            <InputField
              icon={<KeyRound size={20} color="#64748b" />}
              label="PIN"
              required
              value={form.pin}
              onChangeText={(text: string) => setForm({...form, pin: text})}
              placeholder="Ingrese el PIN de 4 dígitos"
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
            />

            <InputField
              icon={<Truck size={20} color="#64748b" />}
              label="Vehículo"
              value={form.vehicle}
              onChangeText={(text: string) => setForm({...form, vehicle: text})}
              placeholder="Descripción del vehículo"
              autoCorrect={false}
            />

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tipo de Vehículo</Text>
              <View style={styles.vehicleTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.vehicleTypeButton,
                    form.vehicle_type === '4_ruedas' &&
                      styles.vehicleTypeSelected,
                  ]}
                  onPress={() => setForm({...form, vehicle_type: '4_ruedas'})}>
                  <Truck
                    size={24}
                    color={
                      form.vehicle_type === '4_ruedas' ? '#ffffff' : '#64748b'
                    }
                  />
                  <Text
                    style={[
                      styles.vehicleTypeText,
                      form.vehicle_type === '4_ruedas' &&
                        styles.vehicleTypeTextSelected,
                    ]}>
                    4 Ruedas
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.vehicleTypeButton,
                    form.vehicle_type === '2_ruedas' &&
                      styles.vehicleTypeSelected,
                  ]}
                  onPress={() => setForm({...form, vehicle_type: '2_ruedas'})}>
                  <Bike
                    size={24}
                    color={
                      form.vehicle_type === '2_ruedas' ? '#ffffff' : '#64748b'
                    }
                  />
                  <Text
                    style={[
                      styles.vehicleTypeText,
                      form.vehicle_type === '2_ruedas' &&
                        styles.vehicleTypeTextSelected,
                    ]}>
                    2 Ruedas
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                loading && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Crear Chofer</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 4,
  },
  required: {
    color: '#ef4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
    height: 48,
  },
  iconContainer: {
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    height: '100%',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 14,
    color: '#1e293b',
    height: '100%',
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  vehicleTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 6,
    height: 40,
  },
  vehicleTypeSelected: {
    backgroundColor: '#0891b2',
    borderColor: '#0891b2',
  },
  vehicleTypeText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  vehicleTypeTextSelected: {
    color: '#ffffff',
  },
  submitButton: {
    backgroundColor: '#0891b2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    height: 44,
    justifyContent: 'center',
    shadowColor: '#0891b2',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default CreateDriverScreen;
