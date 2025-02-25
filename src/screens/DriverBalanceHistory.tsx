import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {format} from 'date-fns';
import {es} from 'date-fns/locale';
import {driverService} from '../services/api';
import {useAuthContext} from '../contexts/AuthContext';
import {BalanceHistory} from '../utils/db_types';

const DriverBalanceHistory = () => {
  const [history, setHistory] = useState<BalanceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today'>('all');
  const {user} = useAuthContext();

  useEffect(() => {
    loadHistory();
  }, [filter]);

  const loadHistory = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      let startDate;
      if (filter === 'today') {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
      }

      const historyData = await driverService.getBalanceHistory(
        user.id,
        startDate?.toISOString(),
      );
      setHistory(historyData);
    } catch (error) {
      console.error('Error loading balance history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'recarga':
        return styles.rechargeAmount;
      case 'descuento':
        return styles.deductionAmount;
      case 'viaje':
        return styles.tripAmount;
      default:
        return {};
    }
  };

  const renderHistoryItem = ({item}: {item: BalanceHistory}) => (
    <View style={styles.historyItem}>
      <View style={styles.historyHeader}>
        <Text style={styles.date}>
          {format(new Date(item.created_at), "d 'de' MMMM, yyyy HH:mm", {
            locale: es,
          })}
        </Text>
        <Text style={[styles.amount, getTypeStyle(item.type)]}>
          {item.type === 'descuento' ? '-' : '+'}$
          {Math.abs(item.amount).toFixed(2)}
        </Text>
      </View>
      <Text style={styles.description}>{item.description}</Text>
      <Text style={styles.type}>
        {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
      </Text>
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
      <View style={styles.header}>
        <Text style={styles.title}>Historial de Balance</Text>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === 'all' && styles.activeFilter,
            ]}
            onPress={() => setFilter('all')}>
            <Text
              style={[
                styles.filterText,
                filter === 'all' && styles.activeFilterText,
              ]}>
              Todo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === 'today' && styles.activeFilter,
            ]}
            onPress={() => setFilter('today')}>
            <Text
              style={[
                styles.filterText,
                filter === 'today' && styles.activeFilterText,
              ]}>
              Hoy
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={history}
        renderItem={renderHistoryItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  activeFilter: {
    backgroundColor: '#0891b2',
  },
  filterText: {
    fontSize: 14,
    color: '#4b5563',
  },
  activeFilterText: {
    color: 'white',
  },
  listContainer: {
    padding: 16,
  },
  historyItem: {
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
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    color: '#6b7280',
  },
  amount: {
    fontSize: 18,
    fontWeight: '600',
  },
  rechargeAmount: {
    color: '#059669',
  },
  deductionAmount: {
    color: '#dc2626',
  },
  tripAmount: {
    color: '#0891b2',
  },
  description: {
    fontSize: 16,
    color: '#1f2937',
    marginBottom: 8,
  },
  type: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
});

export default DriverBalanceHistory;
