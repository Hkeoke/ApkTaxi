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
  SafeAreaView,
} from 'react-native';
import {User, Phone, KeyRound} from 'lucide-react-native';
import {operatorService} from '../services/api';

interface OperatorForm {
  first_name: string;
  last_name: string;
  phone_number: string;
  pin: string;
}

const CreateOperatorScreen = ({navigation}: {navigation: any}) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<OperatorForm>({
    first_name: '',
    last_name: '',
    phone_number: '',
    pin: '',
  });

  const handleSubmit = async () => {
    if (
      !form.first_name ||
      !form.last_name ||
      !form.phone_number ||
      !form.pin
    ) {
      Alert.alert('Error', 'Todos los campos son obligatorios');
      return;
    }

    try {
      setLoading(true);
      const result = await operatorService.createOperator(form);

      if (!result.success) {
        Alert.alert('Error', result.error || 'No se pudo crear el operador');
        return;
      }

      Alert.alert('Éxito', 'Operador creado correctamente', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error en handleSubmit:', error);
      Alert.alert('Error', 'Ocurrió un error al crear el operador');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        <View style={styles.form}>
          <View style={styles.header}>
            <Text style={styles.title}>Crear Operador</Text>
            <Text style={styles.subtitle}>
              Ingrese los datos del nuevo operador
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
                value={form.first_name}
                onChangeText={text => setForm({...form, first_name: text})}
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
                value={form.last_name}
                onChangeText={text => setForm({...form, last_name: text})}
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
                value={form.phone_number}
                onChangeText={text => setForm({...form, phone_number: text})}
                placeholder="Ingrese el número de teléfono"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              PIN<Text style={styles.required}> *</Text>
            </Text>
            <View style={styles.inputContainer}>
              <View style={styles.iconContainer}>
                <KeyRound size={18} color="#64748b" />
              </View>
              <TextInput
                style={styles.input}
                value={form.pin}
                onChangeText={text => setForm({...form, pin: text})}
                placeholder="Ingrese el PIN"
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
            onPress={handleSubmit}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Crear Operador</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  inputGroup: {
    marginBottom: 16,
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
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    height: '100%',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1e293b',
  },
  submitButton: {
    backgroundColor: '#dc2626',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    height: 48,
    justifyContent: 'center',
    shadowColor: '#dc2626',
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
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreateOperatorScreen;
