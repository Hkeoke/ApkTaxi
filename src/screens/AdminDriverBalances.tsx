import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import {driverService} from '../services/api';
import {useAuthContext} from '../contexts/AuthContext';
import {DriverProfile} from '../utils/db_types';
import {Search} from 'lucide-react-native';

const AdminDriverBalances = () => {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(
    null,
  );
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [operationType, setOperationType] = useState<'recarga' | 'descuento'>(
    'recarga',
  );
  const {user} = useAuthContext();

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    try {
      const driversData = await driverService.getAllDrivers();
      setDrivers(driversData);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los conductores');
    }
  };

  const handleBalanceUpdate = async () => {
    if (!selectedDriver || !amount || !description || !user) {
      Alert.alert('Error', 'Por favor complete todos los campos');
      return;
    }

    try {
      await driverService.updateDriverBalance(
        selectedDriver.id,
        Number(amount),
        operationType,
        description,
        user.id,
      );

      Alert.alert('Éxito', 'Balance actualizado correctamente');
      setModalVisible(false);
      setAmount('');
      setDescription('');
      loadDrivers(); // Recargar la lista para mostrar el nuevo balance
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el balance');
    }
  };

  const filteredDrivers = drivers.filter(driver => {
    const fullName = `${driver.first_name} ${driver.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const renderDriver = ({item}: {item: DriverProfile}) => (
    <View style={styles.driverCard}>
      <View style={styles.driverInfo}>
        <Text style={styles.driverName}>
          {item.first_name} {item.last_name}
        </Text>
        <Text style={styles.driverBalance}>
          Balance: ${item.balance?.toFixed(2)}
        </Text>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.rechargeButton]}
          onPress={() => {
            setSelectedDriver(item);
            setOperationType('recarga');
            setModalVisible(true);
          }}>
          <Text style={styles.buttonText}>Recargar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.deductButton]}
          onPress={() => {
            setSelectedDriver(item);
            setOperationType('descuento');
            setModalVisible(true);
          }}>
          <Text style={styles.buttonText}>Descontar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Search size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar conductor..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredDrivers}
        renderItem={renderDriver}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {operationType === 'recarga'
                ? 'Recargar Balance'
                : 'Descontar Balance'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {selectedDriver?.first_name} {selectedDriver?.last_name}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Monto"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <TextInput
              style={[styles.input, styles.descriptionInput]}
              placeholder="Descripción"
              multiline
              value={description}
              onChangeText={setDescription}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleBalanceUpdate}>
                <Text style={styles.modalButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f5',
  },
  listContainer: {
    padding: 16,
  },
  driverCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  driverInfo: {
    marginBottom: 12,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  driverBalance: {
    fontSize: 16,
    color: '#059669',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  rechargeButton: {
    backgroundColor: '#059669',
  },
  deductButton: {
    backgroundColor: '#dc2626',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6b7280',
  },
  confirmButton: {
    backgroundColor: '#0891b2',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    margin: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  searchIcon: {
    marginLeft: 12,
  },
  searchInput: {
    flex: 1,
    padding: 1,
    fontSize: 16,
  },
});

export default AdminDriverBalances;
