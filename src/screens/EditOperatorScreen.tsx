import React, {useState, useEffect} from 'react';
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
import {User, Phone, KeyRound, CreditCard} from 'lucide-react-native';
import {operatorService} from '../services/api';

interface Operator {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  pin?: string;
}

const EditOperatorScreen = ({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) => {
  const operator = route.params?.operator;
  const [loading, setLoading] = useState(false);

  // Asegurarnos de que los datos iniciales se carguen correctamente
  const [formData, setFormData] = useState<Partial<Operator>>({
    first_name: operator?.first_name || '',
    last_name: operator?.last_name || '',
    phone_number: operator?.users?.phone_number || operator?.phone_number || '', // Intentar obtener el teléfono de users o del operador
    pin: '',
  });

  useEffect(() => {
    console.log('Operator data:', operator); // Para debug
    if (operator) {
      setFormData({
        first_name: operator.first_name || '',
        last_name: operator.last_name || '',
        phone_number:
          operator.users?.phone_number || operator.phone_number || '',
        pin: '',
      });
    }
  }, [operator]);

  const handleUpdate = async () => {
    if (!formData.first_name || !formData.last_name || !formData.phone_number) {
      Alert.alert('Error', 'Nombre, apellidos y teléfono son obligatorios');
      return;
    }

    try {
      setLoading(true);
      const updateData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: formData.phone_number,
        ...(formData.pin ? {pin: formData.pin} : {}),
      };

      await operatorService.updateOperator(operator.id, updateData);
      Alert.alert('Éxito', 'Operador actualizado correctamente', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el Operador');
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
              <Text style={styles.title}>Editar Operador</Text>
              <Text style={styles.subtitle}>
                Modifique los datos del Operador
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
                <Text style={styles.submitButtonText}>Actualizar Operador</Text>
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
});

export default EditOperatorScreen;
