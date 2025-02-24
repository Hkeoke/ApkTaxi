import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import {
  Calendar,
  Search,
  User,
  X,
  ChevronDown,
  Filter,
  FileText,
  FileSpreadsheet,
} from 'lucide-react-native';
import {
  analyticsService,
  driverService,
  operatorService,
} from '../services/api';
import DateTimePicker from '@react-native-community/datetimepicker';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import XLSX from 'xlsx';
import RNHTMLtoPDF from 'react-native-html-to-pdf';

interface Trip {
  id: string;
  origin: string;
  destination: string;
  created_at: string;
  driver_profiles: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  operator_profiles: {
    first_name: string;
    last_name: string;
  } | null;
  price: number;
}

interface FilterPerson {
  id: string;
  first_name: string;
  last_name: string;
}

const YearPicker = ({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (year: number) => void;
}) => {
  if (!visible) return null;

  const currentYear = new Date().getFullYear();
  const minDate = new Date(currentYear - 10, 0, 1);
  const maxDate = new Date(currentYear, 11, 31);

  return Platform.OS === 'ios' ? (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.yearPickerContainer}>
          <DateTimePicker
            value={new Date()}
            mode="date"
            display="spinner"
            maximumDate={maxDate}
            minimumDate={minDate}
            locale="es"
            onChange={(event, date) => {
              if (event.type === 'set' && date) {
                onSelect(date.getFullYear());
              }
              onClose();
            }}
          />
          <TouchableOpacity style={styles.closePickerButton} onPress={onClose}>
            <Text style={styles.closePickerButtonText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  ) : (
    <DateTimePicker
      value={new Date()}
      mode="date"
      display="spinner"
      maximumDate={maxDate}
      minimumDate={minDate}
      locale="es"
      onChange={(event, date) => {
        if (event.type === 'set' && date) {
          onSelect(date.getFullYear());
        }
        onClose();
      }}
    />
  );
};

const GeneralReportsScreen = () => {
  const [loading, setLoading] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showFilters, setShowFilters] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<FilterPerson | null>(
    null,
  );
  const [selectedOperator, setSelectedOperator] = useState<FilterPerson | null>(
    null,
  );
  const [drivers, setDrivers] = useState<FilterPerson[]>([]);
  const [operators, setOperators] = useState<FilterPerson[]>([]);
  const [driverSearchTerm, setDriverSearchTerm] = useState('');
  const [operatorSearchTerm, setOperatorSearchTerm] = useState('');
  const [showDrivers, setShowDrivers] = useState(false);
  const [showOperators, setShowOperators] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    loadPersons();
    fetchTrips();
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [selectedYear, selectedDriver, selectedOperator, showFilters]);

  useEffect(() => {
    // Calcular el total cuando cambian los viajes
    const total = trips.reduce((sum, trip) => sum + trip.price, 0);
    setTotalAmount(total);
  }, [trips]);

  const loadPersons = async () => {
    try {
      const [driversData, operatorsData] = await Promise.all([
        driverService.getAllDrivers(),
        operatorService.getAllOperators(),
      ]);
      setDrivers(driversData);
      setOperators(operatorsData);
    } catch (error) {
      console.error('Error al cargar personas:', error);
    }
  };

  const fetchTrips = async () => {
    try {
      setLoading(true);

      if (
        !selectedYear &&
        !selectedDriver?.id &&
        !selectedOperator?.id &&
        !showFilters
      ) {
        const data = await analyticsService.getCompletedTrips();
        setTrips(data);
        return;
      }

      let queryStartDate = startDate;
      let queryEndDate = endDate;

      if (selectedYear) {
        queryStartDate = new Date(selectedYear, 0, 1);
        queryEndDate = new Date(selectedYear, 11, 31);
      }

      const data = await analyticsService.getCompletedTrips(
        queryStartDate.toISOString(),
        queryEndDate.toISOString(),
        selectedDriver?.id || undefined,
        selectedOperator?.id || undefined,
      );
      setTrips(data);
    } catch (error) {
      console.error('Error al obtener viajes:', error);
      Alert.alert('Error', 'No se pudieron cargar los viajes');
    } finally {
      setLoading(false);
    }
  };

  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 33) {
          // Para Android 13 y superior
          const permissions = [
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
          ];

          const results = await Promise.all(
            permissions.map(permission =>
              PermissionsAndroid.request(permission, {
                title: 'Permiso de almacenamiento',
                message:
                  'La aplicación necesita acceso al almacenamiento para guardar archivos.',
                buttonNeutral: 'Preguntar luego',
                buttonNegative: 'Cancelar',
                buttonPositive: 'OK',
              }),
            ),
          );

          return results.every(
            result => result === PermissionsAndroid.RESULTS.GRANTED,
          );
        } else {
          // Para Android 12 y anterior
          const permissions = [
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          ];

          const results = await Promise.all(
            permissions.map(permission =>
              PermissionsAndroid.request(permission, {
                title: 'Permiso de almacenamiento',
                message:
                  'La aplicación necesita acceso al almacenamiento para guardar archivos.',
                buttonNeutral: 'Preguntar luego',
                buttonNegative: 'Cancelar',
                buttonPositive: 'OK',
              }),
            ),
          );

          const granted = results.every(
            result => result === PermissionsAndroid.RESULTS.GRANTED,
          );

          if (!granted) {
            Alert.alert(
              'Permiso denegado',
              'No se puede continuar sin acceso al almacenamiento. Por favor, otorga los permisos en la configuración de la aplicación.',
            );
            return false;
          }
          return true;
        }
      } catch (err) {
        console.error('Error al solicitar permiso:', err);
        Alert.alert(
          'Error',
          'No se pudo verificar los permisos de almacenamiento',
        );
        return false;
      }
    }
    return true; // En iOS no necesitamos estos permisos
  };

  const handleExportPDF = async () => {
    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert('Error', 'Se necesitan permisos de almacenamiento');
        return;
      }

      // Crear HTML para el PDF
      let htmlContent = `
        <html>
          <head>
            <style>
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid black; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .total-row { 
                background-color: #e2e8f0; 
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <h1>Reporte de Viajes</h1>
            <div style="margin-bottom: 20px; padding: 10px; background-color: #f8fafc; border: 1px solid #cbd5e1;">
              <h2 style="margin: 0; color: #0f172a;">Total de Viajes: $${totalAmount.toFixed(
                2,
              )}</h2>
            </div>
            <table>
              <tr>
                <th>Fecha</th>
                <th>Origen</th>
                <th>Destino</th>
                <th>Chofer</th>
                <th>Operador</th>
                <th>Precio</th>
              </tr>
      `;

      trips.forEach(trip => {
        htmlContent += `
          <tr>
            <td>${new Date(trip.created_at).toLocaleDateString()}</td>
            <td>${trip.origin}</td>
            <td>${trip.destination}</td>
            <td>${
              trip.driver_profiles
                ? `${trip.driver_profiles.first_name} ${trip.driver_profiles.last_name}`
                : 'No asignado'
            }</td>
            <td>${
              trip.operator_profiles
                ? `${trip.operator_profiles.first_name} ${trip.operator_profiles.last_name}`
                : 'No asignado'
            }</td>
            <td>$${trip.price}</td>
          </tr>
        `;
      });

      htmlContent += `
            </table>
          </body>
        </html>
      `;

      const fileName = `Reporte_Viajes_${new Date().getTime()}.pdf`;
      const options = {
        html: htmlContent,
        fileName: fileName,
        directory: 'Documents',
      };

      const file = await RNHTMLtoPDF.convert(options);

      await Share.open({
        url: `file://${file.filePath}`,
        type: 'application/pdf',
        filename: fileName,
      });

      Alert.alert('Éxito', 'PDF generado correctamente');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      Alert.alert('Error', 'No se pudo generar el PDF');
    }
  };

  const handleExportExcel = async () => {
    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert('Error', 'Se necesitan permisos de almacenamiento');
        return;
      }

      // Preparar datos para Excel
      const excelData = trips.map(trip => ({
        Fecha: new Date(trip.created_at).toLocaleDateString(),
        Origen: trip.origin,
        Destino: trip.destination,
        Chofer: trip.driver_profiles
          ? `${trip.driver_profiles.first_name} ${trip.driver_profiles.last_name}`
          : 'No asignado',
        Operador: trip.operator_profiles
          ? `${trip.operator_profiles.first_name} ${trip.operator_profiles.last_name}`
          : 'No asignado',
        Precio: trip.price,
      }));

      // Agregar fila con el total
      excelData.push({
        Fecha: '',
        Origen: '',
        Destino: '',
        Chofer: '',
        Operador: 'Total:',
        Precio: totalAmount,
      });

      // Crear workbook
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Viajes');

      // Generar archivo
      const fileName = `Reporte_Viajes_${new Date().getTime()}.xlsx`;
      const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

      // Convertir a buffer
      const wbout = XLSX.write(wb, {type: 'binary', bookType: 'xlsx'});

      // Escribir archivo
      await RNFS.writeFile(filePath, wbout, 'ascii');

      // Mostrar diálogo para compartir/guardar
      await Share.open({
        url: `file://${filePath}`,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: fileName,
      });

      Alert.alert('Éxito', 'Excel generado correctamente');
    } catch (error) {
      console.error('Error al generar Excel:', error);
      Alert.alert('Error', 'No se pudo generar el Excel');
    }
  };

  const renderTrip = ({item}: {item: Trip}) => (
    <View style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <Text style={styles.tripDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
        <Text style={styles.tripPrice}>${item.price}</Text>
      </View>

      <View style={styles.tripDetails}>
        <Text style={styles.label}>Origen:</Text>
        <Text style={styles.value}>{item.origin}</Text>
        <Text style={styles.label}>Destino:</Text>
        <Text style={styles.value}>{item.destination}</Text>
      </View>

      <View style={styles.tripFooter}>
        <View style={styles.personInfo}>
          <Text style={styles.label}>Chofer:</Text>
          <Text style={styles.value}>
            {item.driver_profiles
              ? `${item.driver_profiles.first_name} ${item.driver_profiles.last_name}`
              : 'No asignado'}
          </Text>
        </View>
        <View style={styles.personInfo}>
          <Text style={styles.label}>Operador:</Text>
          <Text style={styles.value}>
            {item.operator_profiles
              ? `${item.operator_profiles.first_name} ${item.operator_profiles.last_name}`
              : 'No asignado'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filtersContainer}>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}>
            <Filter size={20} color="#64748b" />
            <Text style={styles.filterButtonText}>Filtros</Text>
            <ChevronDown size={20} color="#64748b" />
          </TouchableOpacity>

          <View style={styles.exportButtons}>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={handleExportPDF}>
              <FileText size={20} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={handleExportExcel}>
              <FileSpreadsheet size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {showFilters && (
          <View style={styles.filtersPanel}>
            <TouchableOpacity
              style={styles.yearSelector}
              onPress={() => setShowYearPicker(true)}>
              <Calendar size={20} color="#64748b" />
              <Text
                style={[
                  styles.yearSelectorText,
                  !selectedYear && styles.placeholderText,
                ]}>
                {selectedYear ? selectedYear.toString() : 'Seleccionar Año'}
              </Text>
              {selectedYear && (
                <TouchableOpacity
                  onPress={e => {
                    e.stopPropagation();
                    setSelectedYear(null);
                  }}
                  style={styles.clearButton}>
                  <X size={16} color="#ef4444" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            <View style={styles.dateFilters}>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShowStartPicker(true)}>
                <Calendar size={20} color="#64748b" />
                <Text style={styles.input}>
                  {startDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShowEndPicker(true)}>
                <Calendar size={20} color="#64748b" />
                <Text style={styles.input}>{endDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.personFilters}>
              <TouchableOpacity
                style={styles.personSelector}
                onPress={() => setShowDrivers(!showDrivers)}>
                <User size={20} color="#64748b" />
                <Text
                  style={[
                    styles.personSelectorText,
                    !selectedDriver && styles.placeholderText,
                  ]}>
                  {selectedDriver
                    ? `${selectedDriver.first_name} ${selectedDriver.last_name}`
                    : 'Seleccionar Chofer'}
                </Text>
                {selectedDriver && (
                  <TouchableOpacity
                    onPress={e => {
                      e.stopPropagation();
                      setSelectedDriver(null);
                    }}
                    style={styles.clearButton}>
                    <X size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.personSelector}
                onPress={() => setShowOperators(!showOperators)}>
                <User size={20} color="#64748b" />
                <Text
                  style={[
                    styles.personSelectorText,
                    !selectedOperator && styles.placeholderText,
                  ]}>
                  {selectedOperator
                    ? `${selectedOperator.first_name} ${selectedOperator.last_name}`
                    : 'Seleccionar Operador'}
                </Text>
                {selectedOperator && (
                  <TouchableOpacity
                    onPress={e => {
                      e.stopPropagation();
                      setSelectedOperator(null);
                    }}
                    style={styles.clearButton}>
                    <X size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.searchButton}
              onPress={fetchTrips}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Search size={24} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {showDrivers && (
        <View style={styles.dropdownPanel}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar chofer..."
            value={driverSearchTerm}
            onChangeText={setDriverSearchTerm}
          />
          <FlatList
            data={drivers}
            keyExtractor={item => item.id}
            style={styles.dropdownList}
            renderItem={({item}) => (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedDriver(item);
                  setShowDrivers(false);
                  setDriverSearchTerm('');
                }}>
                <Text style={styles.dropdownItemText}>
                  {item.first_name} {item.last_name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {showOperators && (
        <View style={styles.dropdownPanel}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar operador..."
            value={operatorSearchTerm}
            onChangeText={setOperatorSearchTerm}
          />
          <FlatList
            data={operators}
            keyExtractor={item => item.id}
            style={styles.dropdownList}
            renderItem={({item}) => (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedOperator(item);
                  setShowOperators(false);
                  setOperatorSearchTerm('');
                }}>
                <Text style={styles.dropdownItemText}>
                  {item.first_name} {item.last_name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total de Viajes:</Text>
        <Text style={styles.totalAmount}>${totalAmount.toFixed(2)}</Text>
      </View>

      <FlatList
        data={trips}
        renderItem={renderTrip}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No hay viajes que mostrar</Text>
        }
      />

      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          onChange={(event, date) => {
            setShowStartPicker(false);
            if (date) setStartDate(date);
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          onChange={(event, date) => {
            setShowEndPicker(false);
            if (date) setEndDate(date);
          }}
        />
      )}

      <YearPicker
        visible={showYearPicker}
        onClose={() => setShowYearPicker(false)}
        onSelect={year => setSelectedYear(year)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  filtersContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  exportButton: {
    backgroundColor: '#0891b2',
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButton: {
    flex: 1,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterButtonText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#64748b',
  },
  filtersPanel: {
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 44,
    marginBottom: 12,
  },
  yearSelectorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#0f172a',
  },
  dateFilters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 44,
    minWidth: '45%',
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#0f172a',
  },
  personFilters: {
    gap: 8,
  },
  personSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 44,
    marginBottom: 8,
  },
  personSelectorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#0f172a',
  },
  clearButton: {
    padding: 4,
  },
  searchButton: {
    backgroundColor: '#0891b2',
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    alignSelf: 'flex-end',
  },
  dropdownPanel: {
    position: 'absolute',
    top: '100%',
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
  searchInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  dropdownList: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#0f172a',
  },
  listContainer: {
    padding: 16,
  },
  tripCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tripDate: {
    fontSize: 13,
    color: '#64748b',
  },
  tripPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0891b2',
  },
  tripDetails: {
    marginBottom: 8,
  },
  tripFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    gap: 4,
  },
  personInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: '#64748b',
    marginRight: 8,
    minWidth: 60,
  },
  value: {
    fontSize: 13,
    color: '#0f172a',
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 16,
    marginTop: 24,
  },
  placeholderText: {
    color: '#94a3b8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  yearPickerContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  closePickerButton: {
    backgroundColor: '#0891b2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  closePickerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  totalContainer: {
    backgroundColor: '#f8fafc',
    padding: 16,
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0891b2',
  },
});

export default GeneralReportsScreen;
