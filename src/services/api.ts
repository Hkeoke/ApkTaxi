import supabase from '../utils/supabase';
import {
  User,
  DriverProfile,
  OperatorProfile,
  Trip,
  Role,
  TripStatus,
} from '../utils/db_types';

// En tripService
export const tripRequestService = {
  async createBroadcastRequest(requestData: any) {
    const {operator_id, ...rest} = requestData;
    const {data, error} = await supabase
      .from('trip_requests')
      .insert([
        {
          ...rest,
          created_by: operator_id,
          status: 'broadcasting',
        },
      ])
      .select();

    if (error) throw error;
    return data;
  },

  // Modificar el método para obtener solicitudes pendientes
  async getDriverPendingRequests(driverId: string, vehicleType: string) {
    try {
      // Primero obtenemos la ubicación actual del chofer
      const {data: driverData, error: driverError} = await supabase
        .from('driver_profiles')
        .select('latitude, longitude, vehicle_type')
        .eq('id', driverId)
        .single();

      if (driverError) throw driverError;
      if (!driverData?.latitude || !driverData?.longitude) {
        console.log('Chofer sin ubicación actualizada');
        return [];
      }

      // Primero obtenemos las solicitudes con la información básica
      const {data: requests, error: requestsError} = await supabase
        .from('trip_requests')
        .select('*, created_by')
        .eq('status', 'broadcasting')
        .eq('vehicle_type', vehicleType);

      if (requestsError) throw requestsError;

      // Obtenemos los usuarios creadores
      const creatorIds = requests?.map(req => req.created_by) || [];
      const {data: creators, error: creatorsError} = await supabase
        .from('users')
        .select('id, role')
        .in('id', creatorIds);

      if (creatorsError) throw creatorsError;

      // Obtenemos los perfiles de operadores
      const operatorIds =
        creators
          ?.filter(creator => creator.role === 'operador')
          .map(creator => creator.id) || [];

      const {data: operatorProfiles, error: operatorError} = await supabase
        .from('operator_profiles')
        .select('id, first_name, last_name')
        .in('id', operatorIds);

      if (operatorError) throw operatorError;

      // Procesamos los datos para tener un formato uniforme
      const processedRequests = requests?.map(request => {
        const creator = creators?.find(c => c.id === request.created_by);
        const isOperator = creator?.role === 'operador';
        const operatorProfile = operatorProfiles?.find(
          op => op.id === request.created_by,
        );

        return {
          ...request,
          creator: {
            first_name: isOperator ? operatorProfile?.first_name : 'Admin',
            last_name: isOperator ? operatorProfile?.last_name : '',
            role: creator?.role,
          },
        };
      });

      // Filtramos las solicitudes por distancia
      const nearbyRequests = processedRequests?.filter(request => {
        const distance = this.calculateDistance(
          driverData.latitude,
          driverData.longitude,
          request.origin_lat,
          request.origin_lng,
        );
        return distance <= request.search_radius;
      });

      return nearbyRequests || [];
    } catch (error) {
      console.error('Error en getDriverPendingRequests:', error);
      return [];
    }
  },

  // Función auxiliar para calcular distancia
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000; // Radio de la Tierra en metros
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) *
        Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;

    return d;
  },

  async createRequest(requestData: {
    driver_id: string;
    operator_id: string;
    origin: string;
    destination: string;
    price: number;
  }) {
    const {data, error} = await supabase
      .from('trip_requests')
      .insert(requestData)
      .single();

    if (error) throw error;
    return data;
  },

  async updateRequestStatus(
    requestId: string,
    status: string,
    driverId?: string,
  ) {
    const updates: any = {status};
    if (driverId && status === 'accepted') {
      updates.driver_id = driverId;
    }

    const {data, error} = await supabase
      .from('trip_requests')
      .update(updates)
      .eq('id', requestId)
      .select();

    if (error) throw error;
    return data;
  },

  async convertRequestToTrip(requestId: string) {
    try {
      // Primero obtenemos los datos de la solicitud para asegurarnos de tener el driver_id
      const {data: request, error: requestError} = await supabase
        .from('trip_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError || !request) {
        throw new Error('No se pudo obtener la solicitud');
      }

      // Llamar a la función de la base de datos con los datos completos
      const {data, error} = await supabase.rpc('convert_request_to_trip', {
        request_id: requestId,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error converting request to trip:', error);
      throw error;
    }
  },

  async updateTripStatus(tripId: string, status: TripStatus) {
    const updates: Partial<Trip> = {
      status,
      ...(status === 'completed'
        ? {completed_at: new Date().toISOString()}
        : {}),
    };

    const {data, error} = await supabase
      .from('trips')
      .update(updates)
      .eq('id', tripId)
      .select('*')
      .single();

    if (error) throw error;
    return data as Trip;
  },
};

export const authService = {
  async login(phone_number: string, pin: string): Promise<User> {
    const {data, error} = await supabase
      .from('users')
      .select(
        `
          *,
          driver_profiles(*),
          operator_profiles(*)
        `,
      )
      .eq('phone_number', phone_number)
      .eq('pin', pin)
      .eq('active', true)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Usuario no encontrado');

    console.log('Datos del usuario después del login:', data);
    return data as User;
  },

  async register(userData: Partial<User>) {
    const {data, error} = await supabase
      .from('users')
      .insert(userData)
      .single();

    if (error) throw error;
    return data;
  },
};

export const driverService = {
  async createProfile(profileData: Partial<DriverProfile>) {
    const {data, error} = await supabase
      .from('driver_profiles')
      .insert(profileData)
      .single();

    if (error) throw error;
    return data;
  },
  async updateLocation(driverId: string, latitude: number, longitude: number) {
    const {data, error} = await supabase
      .from('driver_profiles')
      .update({
        latitude,
        longitude,
        last_location_update: new Date().toISOString(),
      })
      .eq('id', driverId)
      .single();

    if (error) throw error;
    return data;
  },

  async getAvailableDrivers() {
    const {data, error} = await supabase
      .from('driver_profiles')
      .select(
        `
        *,
        users!inner(*)
      `,
      )
      .eq('users.active', true) // Usuario activo
      .eq('is_on_duty', true) // Chofer en servicio
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) throw error;

    return data || [];
  },
  async getDriverProfile(driverId: string): Promise<DriverProfile> {
    const {data, error} = await supabase
      .from('driver_profiles')
      .select('*, is_on_duty')
      .eq('id', driverId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Perfil de conductor no encontrado');

    return data;
  },

  async updateBalance(
    driverId: string,
    amount: number,
    isDeduction: boolean = false,
  ) {
    try {
      // Si es una deducción, convertimos el monto a negativo
      const finalAmount = isDeduction ? -amount : amount;

      const {error} = await supabase.rpc('increment_driver_balance', {
        driver_id: driverId,
        amount: finalAmount,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating driver balance:', error);
      throw error;
    }
  },

  async getActiveTrips(driverId: string) {
    const {data, error} = await supabase
      .from('trips')
      .select(
        `
          *,
          operator_profiles (
            first_name,
            last_name
          )
        `,
      )
      .eq('driver_id', driverId)
      .in('status', ['pending', 'in_progress']);

    if (error) throw error;
    return data;
  },

  async getAllDriversWithLocation() {
    try {
      const {data, error} = await supabase
        .from('driver_profiles')
        .select(
          `
          *,
          users!inner (
            active
          )
        `,
        )
        .eq('users.active', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('created_at', {ascending: false});

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error en getAllDriversWithLocation:', error);
      return [];
    }
  },

  async getAllDrivers() {
    const {data, error} = await supabase
      .from('driver_profiles')
      .select(
        `
        *,
        users (
          active
        )
      `,
      )
      .order('created_at', {ascending: false});

    if (error) throw error;
    return data;
  },

  async createDriver(driverData: {
    first_name: string;
    last_name: string;
    phone_number: string;
    vehicle: string;
    vehicle_type: '2_ruedas' | '4_ruedas';
    pin: string;
  }) {
    try {
      console.log('Iniciando creación de conductor:', driverData);

      // Primero verificamos si ya existe un usuario con ese número de teléfono
      const {data: existingUser} = await supabase
        .from('users')
        .select('*')
        .eq('phone_number', driverData.phone_number)
        .single();

      if (existingUser) {
        throw new Error('Ya existe un usuario con este número de teléfono');
      }

      // Creamos el usuario
      const {data: userData, error: userError} = await supabase
        .from('users')
        .insert({
          phone_number: driverData.phone_number,
          pin: driverData.pin,
          role: 'chofer',
          active: true,
        })
        .select()
        .single();

      if (userError) {
        console.error('Error al crear usuario:', userError);
        throw new Error(`Error al crear usuario: ${userError.message}`);
      }

      if (!userData) {
        console.error('No se recibieron datos del usuario creado');
        throw new Error('No se pudo crear el usuario');
      }

      console.log('Usuario creado exitosamente:', userData);

      // Creamos el perfil del conductor
      const {data: driverProfile, error: driverError} = await supabase
        .from('driver_profiles')
        .insert({
          id: userData.id,
          first_name: driverData.first_name,
          last_name: driverData.last_name,
          phone_number: driverData.phone_number,
          vehicle: driverData.vehicle,
          vehicle_type: driverData.vehicle_type,
          license_number: `LIC-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 7)}`,
        })
        .select()
        .single();

      if (driverError) {
        console.error('Error al crear perfil del conductor:', driverError);
        // Eliminamos el usuario si falla la creación del perfil
        await supabase.from('users').delete().eq('id', userData.id);
        throw new Error(
          `Error al crear perfil del conductor: ${driverError.message}`,
        );
      }

      if (!driverProfile) {
        console.error('No se recibieron datos del perfil creado');
        await supabase.from('users').delete().eq('id', userData.id);
        throw new Error('No se pudo crear el perfil del conductor');
      }

      console.log('Perfil de conductor creado exitosamente:', driverProfile);

      return {
        success: true,
        data: {
          ...userData,
          driver_profile: driverProfile,
        },
      };
    } catch (error) {
      console.error('Error en createDriver:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  },

  async updateDriverStatus(driverId: string, isActive: boolean) {
    // Solo actualizamos el estado del usuario (active)
    const {data, error: userError} = await supabase
      .from('users')
      .update({active: isActive})
      .eq('id', driverId)
      .select(
        `
        *,
        driver_profiles (
          id,
          first_name,
          last_name,
          phone_number,
          vehicle,
          vehicle_type,
          is_on_duty,
          balance
        )
      `,
      )
      .single();

    if (userError) throw userError;
    return data;
  },

  async deleteDriver(driverId: string) {
    // Para eliminar un chofer, solo desactivamos su usuario
    const {error: userError} = await supabase
      .from('users')
      .update({active: false})
      .eq('id', driverId);

    if (userError) throw userError;
  },

  async updateDriver(driverId: string, driverData: Partial<DriverProfile>) {
    const updates: any = {
      first_name: driverData.first_name,
      last_name: driverData.last_name,
      phone_number: driverData.phone_number,
      vehicle: driverData.vehicle,
      vehicle_type: driverData.vehicle_type,
    };

    // Solo incluir el PIN en la actualización si se proporcionó uno nuevo
    if (driverData.pin) {
      // También actualizar el PIN en la tabla de usuarios
      await supabase
        .from('users')
        .update({pin: driverData.pin})
        .eq('id', driverId);
    }

    const {data, error} = await supabase
      .from('driver_profiles')
      .update(updates)
      .eq('id', driverId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async toggleDutyStatus(driverId: string) {
    try {
      // Primero obtenemos el estado actual
      const {data: currentState, error: fetchError} = await supabase
        .from('driver_profiles')
        .select('is_on_duty')
        .eq('id', driverId)
        .single();

      if (fetchError) throw fetchError;

      const newDutyStatus = !currentState?.is_on_duty;

      // Ahora actualizamos al estado opuesto
      const {data, error} = await supabase
        .from('driver_profiles')
        .update({
          is_on_duty: newDutyStatus,
          last_duty_change: new Date().toISOString(),
        })
        .eq('id', driverId)
        .select('is_on_duty')
        .single();

      if (error) throw error;

      console.log('Nuevo estado de servicio:', data?.is_on_duty);
      return {
        success: true,
        isOnDuty: data?.is_on_duty || false,
      };
    } catch (error) {
      console.error('Error toggling duty status:', error);
      return {
        success: false,
        isOnDuty: false,
      };
    }
  },
};

export const operatorService = {
  async createProfile(profileData: Partial<OperatorProfile>) {
    const {data, error} = await supabase
      .from('operator_profiles')
      .insert(profileData)
      .single();

    if (error) throw error;
    return data;
  },
  async getActiveDriversWithLocation() {
    const {data, error} = await supabase
      .from('driver_profiles')
      .select(
        `
          *,
          users!inner (
            active
          )
        `,
      )
      .eq('users.active', true)
      .eq('is_on_duty', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) throw error;
    return data;
  },

  async assignTripToDriver(tripId: string, driverId: string) {
    const {data, error} = await supabase
      .from('trips')
      .update({
        driver_id: driverId,
        status: 'in_progress',
      })
      .eq('id', tripId)
      .single();

    if (error) throw error;
    return data;
  },

  async getPendingTrips() {
    const {data, error} = await supabase
      .from('trips')
      .select(
        `
          *,
          driver_profiles (
            first_name,
            last_name,
            vehicle
          )
        `,
      )
      .eq('status', 'pending');

    if (error) throw error;
    return data;
  },

  async getAllOperators() {
    const {data, error} = await supabase
      .from('operator_profiles')
      .select(
        `
        id,
        first_name,
        last_name
      `,
      )
      .order('first_name', {ascending: true});

    if (error) throw error;
    return data || [];
  },

  async createOperator(operatorData: any) {
    try {
      // Crear usuario primero
      const {data: userData, error: userError} = await supabase.auth.signUp({
        phone: operatorData.phone_number,
        password: operatorData.pin,
      });

      if (userError) throw userError;

      // Generar identity_card automáticamente
      const identity_card = `OP${Date.now().toString().slice(-6)}`;

      // Crear perfil de operador
      const {data: operatorProfile, error: operatorError} = await supabase
        .from('operator_profiles')
        .insert([
          {
            id: userData.user?.id,
            first_name: operatorData.first_name,
            last_name: operatorData.last_name,
            identity_card, // Usar el identity_card generado
          },
        ])
        .select()
        .single();

      if (operatorError) throw operatorError;

      return {success: true, data: operatorProfile};
    } catch (error) {
      console.error('Error creating operator:', error);
      return {success: false, error: 'Error al crear el operador'};
    }
  },

  async updateOperator(operatorId: string, operatorData: any) {
    const updates = {
      first_name: operatorData.first_name,
      last_name: operatorData.last_name,
      identity_card: operatorData.identity_card,
    };

    if (operatorData.pin) {
      await supabase
        .from('users')
        .update({pin: operatorData.pin})
        .eq('id', operatorId);
    }

    const {data, error} = await supabase
      .from('operator_profiles')
      .update(updates)
      .eq('id', operatorId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateOperatorStatus(operatorId: string, isActive: boolean) {
    const {data, error} = await supabase
      .from('users')
      .update({active: isActive})
      .eq('id', operatorId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteOperator(operatorId: string) {
    const {error} = await supabase
      .from('users')
      .update({active: false})
      .eq('id', operatorId);

    if (error) throw error;
  },
};

export const tripService = {
  async createTrip(tripData: Partial<Trip>) {
    const {data, error} = await supabase
      .from('trips')
      .insert(tripData)
      .single();

    if (error) throw error;
    return data;
  },

  async updateTripStatus(tripId: string, status: TripStatus) {
    const updates: Partial<Trip> = {
      status,
      ...(status === 'completed'
        ? {completed_at: new Date().toISOString()}
        : {}),
    };

    const {data, error} = await supabase
      .from('trips')
      .update(updates)
      .eq('id', tripId)
      .select('*')
      .single();

    if (error) throw error;
    return data as Trip;
  },

  async getDriverTrips(driverId: string) {
    try {
      const {data, error} = await supabase
        .from('trips')
        .select(
          `
          id,
          status,
          price,
          origin,
          destination,
          created_at,
          driver_profiles!inner (
            id,
            first_name,
            last_name
          )
        `,
        )
        .eq('driver_id', driverId)
        .in('status', ['completed', 'cancelled'])
        .order('created_at', {ascending: false});

      if (error) {
        console.error('Error in getDriverTrips:', error);
        throw error;
      }

      // Calculamos la comisión (10%) para cada viaje
      const tripsWithCommission =
        data?.map(trip => ({
          ...trip,
          commission: trip.price * 0.1,
        })) || [];

      return tripsWithCommission;
    } catch (error) {
      console.error('Error fetching driver trips:', error);
      return [];
    }
  },

  async getOperatorTrips(operatorId: string) {
    const {data, error} = await supabase
      .from('trips')
      .select(
        `
        id,
        status,
        price,
        origin,
        destination,
        created_at,
        completed_at,
        created_by
      `,
      )
      .eq('created_by', operatorId)
      .order('created_at', {ascending: false});

    if (error) throw error;
    return data;
  },
};
export const analyticsService = {
  async getDriverStats(driverId: string, startDate: string, endDate: string) {
    const {data, error} = await supabase
      .from('trips')
      .select('*')
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;
    return data;
  },

  async getOperatorStats(
    operatorId: string,
    startDate: string,
    endDate: string,
  ) {
    const {data, error} = await supabase
      .from('trips')
      .select('*')
      .eq('operator_id', operatorId)
      .eq('status', 'completed')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;
    return data;
  },

  async getDailyRevenue(date: string) {
    const {data, error} = await supabase
      .from('trips')
      .select('price')
      .eq('status', 'completed')
      .gte('created_at', date)
      .lte('created_at', date + 'T23:59:59');

    if (error) throw error;
    return data.reduce((sum, trip) => sum + Number(trip.price), 0);
  },

  async getAdminDashboardStats() {
    try {
      // Obtener la fecha de inicio (00:00:00) y fin (23:59:59) del día actual
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const [tripsToday, activeDrivers, totalUsers] = await Promise.all([
        // Obtener viajes completados de hoy
        supabase
          .from('trips')
          .select('*', {count: 'exact'})
          .eq('status', 'completed')
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay),

        // Obtener choferes activos
        supabase
          .from('driver_profiles')
          .select(
            `
            *,
            users!inner (*)
          `,
            {count: 'exact'},
          )
          .eq('users.active', true)
          .eq('is_on_duty', true),

        // Obtener total de usuarios
        supabase.from('users').select('*', {count: 'exact'}).eq('active', true),
      ]);

      return {
        tripsToday: tripsToday.count || 0,
        activeDrivers: activeDrivers.count || 0,
        totalUsers: totalUsers.count || 0,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  },

  async getDriverTripStats(
    driverId: string,
    timeFrame: 'day' | 'week' | 'month',
  ) {
    try {
      console.log('Iniciando consulta para driver:', driverId);
      console.log('Timeframe:', timeFrame);

      // Calcular fechas correctamente
      const now = new Date();
      let startDate = new Date();

      switch (timeFrame) {
        case 'day':
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          break;
        case 'week':
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 7,
          );
          break;
        case 'month':
          startDate = new Date(
            now.getFullYear(),
            now.getMonth() - 1,
            now.getDate(),
          );
          break;
      }

      console.log('Fecha inicio:', startDate.toISOString());
      console.log('Fecha fin:', now.toISOString());

      // Consulta con filtros de fecha
      const {data: trips, error: tripsError} = await supabase
        .from('trips')
        .select('*')
        .eq('driver_id', driverId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', now.toISOString());

      if (tripsError) {
        console.error('Error en consulta de viajes:', tripsError);
        throw tripsError;
      }

      // Consulta del perfil del conductor activo
      const {data: driver, error: driverError} = await supabase
        .from('driver_profiles')
        .select(
          `
          *,
          users!inner (*)
        `,
        )
        .eq('id', driverId)
        .eq('users.active', true) // Agregamos filtro para usuarios activos
        .single();

      if (driverError) {
        console.error('Error en consulta del perfil:', driverError);
        throw driverError;
      }

      if (!driver) {
        throw new Error('Conductor no encontrado o inactivo');
      }

      // Calcular estadísticas
      const totalTrips = trips ? trips.length : 0;
      const totalEarnings = trips
        ? trips.reduce((sum, trip) => sum + (Number(trip.price) || 0), 0)
        : 0;
      const balance = driver?.balance || 0;

      const stats = {
        totalTrips,
        totalEarnings,
        balance,
      };

      console.log('Estadísticas calculadas:', stats);
      return stats;
    } catch (error) {
      console.error('Error completo en getDriverTripStats:', error);
      throw error;
    }
  },

  async getCompletedTrips(
    startDate?: string,
    endDate?: string,
    driverId?: string,
    operatorId?: string,
  ) {
    try {
      let query = supabase
        .from('trips')
        .select(
          `
          *,
          driver_profiles (
            id,
            first_name,
            last_name
          ),
          users!created_by (
            id,
            role,
            operator_profiles (
              first_name,
              last_name
            )
          )
        `,
        )
        .eq('status', 'completed')
        .order('created_at', {ascending: false});

      // Aplicar filtros solo si están presentes
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }
      if (driverId) {
        query = query.eq('driver_id', driverId);
      }
      if (operatorId) {
        query = query.eq('created_by', operatorId);
      }

      const {data, error} = await query;

      if (error) throw error;

      // Transformar los datos para mantener la estructura esperada
      const transformedData =
        data?.map(trip => ({
          ...trip,
          operator_profiles: trip.users?.operator_profiles || null,
        })) || [];

      return transformedData;
    } catch (error) {
      console.error('Error en getCompletedTrips:', error);
      throw error;
    }
  },

  async getOperatorCompletedTrips(
    startDate: string,
    endDate: string,
    operatorId?: string,
  ) {
    let query = supabase
      .from('trips')
      .select(
        `
        *,
        driver_profiles (
          id,
          first_name,
          last_name
        ),
        users!created_by (
          id,
          role,
          operator_profiles (
            first_name,
            last_name
          )
        )
      `,
      )
      .eq('status', 'completed')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', {ascending: false});

    if (operatorId) {
      query = query.eq('created_by', operatorId);
    }

    const {data, error} = await query;

    if (error) throw error;

    // Transformar los datos para mantener la estructura esperada
    const transformedData =
      data?.map(trip => ({
        ...trip,
        operator_profiles: trip.users?.operator_profiles || null,
      })) || [];

    return transformedData;
  },
};
