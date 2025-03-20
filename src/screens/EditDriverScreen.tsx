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
import {User, Phone, Truck, Bike, KeyRound, Star} from 'lucide-react-native';
import {driverService} from '../services/api';

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  vehicle: string;
  vehicle_type: '2_ruedas' | '4_ruedas';
  pin?: string;
  is_special: boolean;
}

interface InputFieldProps {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  value: string | undefined;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
  maxLength?: number;
}

const EditDriverScreen = ({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) => {
  const driver = route.params?.driver;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Driver>>({
    first_name: driver.first_name,
    last_name: driver.last_name,
    phone_number: driver.phone_number,
    vehicle: driver.vehicle,
    vehicle_type: driver.vehicle_type,
    pin: '',
    is_special: driver.is_special || false,
  });

  const handleUpdate = async () => {
    if (
      !formData.first_name ||
      !formData.last_name ||
      !formData.phone_number ||
      !formData.vehicle
    ) {
      Alert.alert('Error', 'Todos los campos son obligatorios');
      return;
    }

    try {
      setLoading(true);
      await driverService.updateDriver(driver.id, formData);
      Alert.alert('Éxito', 'Chofer actualizado correctamente', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el Chofer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{flex: 1}}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always">
          <View style={styles.form}>
            <View style={styles.header}>
              <Text style={styles.title}>Editar Chofer</Text>
              <Text style={styles.subtitle}>
                Modifique los datos del Chofer
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Nombre<Text style={styles.required}> *</Text>
              </Text>
              <View style={styles.inputContainer}>
                <View style={styles.iconContainer}>
                  <User size={18} color="#64748b" />
                </View>
                <TextInput
                  style={styles.input}
                  value={formData.first_name}
                  onChangeText={text =>
                    setFormData({...formData, first_name: text})
                  }
                  placeholder="Ingrese el nombre"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Apellidos<Text style={styles.required}> *</Text>
              </Text>
              <View style={styles.inputContainer}>
                <View style={styles.iconContainer}>
                  <User size={18} color="#64748b" />
                </View>
                <TextInput
                  style={styles.input}
                  value={formData.last_name}
                  onChangeText={text =>
                    setFormData({...formData, last_name: text})
                  }
                  placeholder="Ingrese los apellidos"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Teléfono<Text style={styles.required}> *</Text>
              </Text>
              <View style={styles.inputContainer}>
                <View style={styles.iconContainer}>
                  <Phone size={18} color="#64748b" />
                </View>
                <TextInput
                  style={styles.input}
                  value={formData.phone_number}
                  onChangeText={text =>
                    setFormData({...formData, phone_number: text})
                  }
                  placeholder="Ingrese el número de teléfono"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Vehículo<Text style={styles.required}> *</Text>
              </Text>
              <View style={styles.inputContainer}>
                <View style={styles.iconContainer}>
                  <Truck size={18} color="#64748b" />
                </View>
                <TextInput
                  style={styles.input}
                  value={formData.vehicle}
                  onChangeText={text =>
                    setFormData({...formData, vehicle: text})
                  }
                  placeholder="Descripción del vehículo"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>PIN</Text>
              <View style={styles.inputContainer}>
                <View style={styles.iconContainer}>
                  <KeyRound size={18} color="#64748b" />
                </View>
                <TextInput
                  style={styles.input}
                  value={formData.pin}
                  onChangeText={text => setFormData({...formData, pin: text})}
                  placeholder="Ingrese nuevo PIN (opcional)"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tipo de Vehículo</Text>
              <View style={styles.vehicleTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.vehicleTypeButton,
                    formData.vehicle_type === '4_ruedas' &&
                      styles.vehicleTypeSelected,
                  ]}
                  onPress={() =>
                    setFormData({...formData, vehicle_type: '4_ruedas'})
                  }>
                  <Truck
                    size={24}
                    color={
                      formData.vehicle_type === '4_ruedas'
                        ? '#ffffff'
                        : '#64748b'
                    }
                  />
                  <Text
                    style={[
                      styles.vehicleTypeText,
                      formData.vehicle_type === '4_ruedas' &&
                        styles.vehicleTypeTextSelected,
                    ]}>
                    4 Ruedas
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.vehicleTypeButton,
                    formData.vehicle_type === '2_ruedas' &&
                      styles.vehicleTypeSelected,
                  ]}
                  onPress={() =>
                    setFormData({...formData, vehicle_type: '2_ruedas'})
                  }>
                  <Bike
                    size={24}
                    color={
                      formData.vehicle_type === '2_ruedas'
                        ? '#ffffff'
                        : '#64748b'
                    }
                  />
                  <Text
                    style={[
                      styles.vehicleTypeText,
                      formData.vehicle_type === '2_ruedas' &&
                        styles.vehicleTypeTextSelected,
                    ]}>
                    2 Ruedas
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Conductor Especial</Text>
              <TouchableOpacity
                style={styles.specialDriverButton}
                onPress={() => setFormData(prev => ({
                  ...prev,
                  is_special: !prev.is_special
                }))}>
                <Star
                  size={24}
                  fill={formData.is_special ? '#dc2626' : 'none'}
                  color={formData.is_special ? '#dc2626' : '#64748b'}
                />
                <Text style={[
                  styles.specialDriverText,
                  formData.is_special && styles.specialDriverTextSelected
                ]}>
                  Conductor Prioritario
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                loading && styles.submitButtonDisabled,
              ]}
              onPress={handleUpdate}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Actualizar Chofer</Text>
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
    backgroundColor: '#fecaca',
    borderColor: '#dc2626',
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
    backgroundColor: '#dc2626',
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
  specialDriverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  specialDriverText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  specialDriverTextSelected: {
    color: '#dc2626',
  },
});

export default EditDriverScreen;
