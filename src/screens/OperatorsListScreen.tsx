import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  User,
  MoreVertical,
  Edit,
  Trash,
  Power,
  PowerOff,
} from 'lucide-react-native';
import {operatorService} from '../services/api';

interface Operator {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  identity_card: string;
  is_active: boolean;
  created_at: string;
}

const OperatorsListScreen = ({navigation}: {navigation: any}) => {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);

  useEffect(() => {
    fetchOperators();
  }, []);

  const fetchOperators = async () => {
    try {
      const response = await operatorService.getAllOperators();
      setOperators(response as Operator[]);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los operadores');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (
    operatorId: string,
    currentStatus: boolean,
  ) => {
    try {
      await operatorService.updateOperatorStatus(operatorId, !currentStatus);
      fetchOperators();
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el estado del operador');
    }
  };

  const handleDelete = async (operatorId: string) => {
    Alert.alert('Confirmar', '¿Está seguro que desea eliminar este operador?', [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await operatorService.deleteOperator(operatorId);
            fetchOperators();
          } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar el operador');
          }
        },
      },
    ]);
  };

  const renderOperator = ({item}: {item: Operator}) => (
    <View style={styles.operatorCard}>
      <View style={styles.operatorInfo}>
        <View
          style={[
            styles.statusIndicator,
            {
              backgroundColor: item.is_active ? '#22c55e' : '#94a3b8',
            },
          ]}
        />
        <View style={styles.operatorDetails}>
          <Text style={styles.operatorName}>
            {item.first_name} {item.last_name}
          </Text>
          <Text style={styles.operatorIdentity}>{item.identity_card}</Text>
          <Text style={styles.operatorPhone}>{item.phone_number}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            navigation.navigate('EditOperator', {
              operator: item,
            })
          }>
          <Edit size={20} color="#64748b" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleToggleActive(item.id, item.is_active)}>
          {item.is_active ? (
            <PowerOff size={20} color="#64748b" />
          ) : (
            <Power size={20} color="#64748b" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(item.id)}>
          <Trash size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0891b2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={operators}
        renderItem={renderOperator}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No hay operadores registrados</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  operatorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    height: 64,
  },
  operatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: '100%',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  operatorDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  operatorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  operatorIdentity: {
    fontSize: 13,
    color: '#64748b',
  },
  operatorPhone: {
    fontSize: 13,
    color: '#64748b',
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    padding: 6,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 16,
    marginTop: 24,
  },
});

export default OperatorsListScreen;
