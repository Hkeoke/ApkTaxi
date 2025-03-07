import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  User,
  Calendar,
  Clock,
  TrendingUp,
  Plus,
  Filter,
  ChevronRight,
} from 'lucide-react-native';
import {driverService, analyticsService} from '../services/api';

const DriverManagementScreen = ({navigation}: {navigation: any}) => {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Sección de Gestión de Choferes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gestión de Choferes</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('CreateDriverScreen')}>
            <View style={styles.menuItemContent}>
              <Plus size={24} color="#dc2626" />
              <Text style={styles.menuItemText}>Crear Nuevo Chofer</Text>
            </View>
            <ChevronRight size={20} color="#dc2626" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('DriversListScreen')}>
            <View style={styles.menuItemContent}>
              <User size={24} color="#dc2626" />
              <Text style={styles.menuItemText}>Lista de Choferes</Text>
            </View>
            <ChevronRight size={20} color="#dc2626" />
          </TouchableOpacity>
        </View>

        {/* Sección de Reportes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reportes</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('DriverReports')}>
            <View style={styles.menuItemContent}>
              <Calendar size={24} color="#dc2626" />
              <Text style={styles.menuItemText}>Reportes por Período</Text>
            </View>
            <ChevronRight size={20} color="#dc2626" />
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
    borderBottomColor: '#dc2626',
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

export default DriverManagementScreen;
