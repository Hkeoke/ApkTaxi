import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {User, Calendar, Plus, Filter, ChevronRight} from 'lucide-react-native';

const OperatorManagementScreen = ({navigation}: {navigation: any}) => {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Sección de Gestión de Operadores */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gestión de Operadores</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('CreateOperatorScreen')}>
            <View style={styles.menuItemContent}>
              <Plus size={24} color="#0891b2" />
              <Text style={styles.menuItemText}>Crear Nuevo Operador</Text>
            </View>
            <ChevronRight size={20} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('OperatorsListScreen')}>
            <View style={styles.menuItemContent}>
              <User size={24} color="#0891b2" />
              <Text style={styles.menuItemText}>Lista de Operadores</Text>
            </View>
            <ChevronRight size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Sección de Reportes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reportes</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('OperatorReports')}>
            <View style={styles.menuItemContent}>
              <Calendar size={24} color="#0891b2" />
              <Text style={styles.menuItemText}>Reportes por Período</Text>
            </View>
            <ChevronRight size={20} color="#64748b" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#334155',
  },
});

export default OperatorManagementScreen;
