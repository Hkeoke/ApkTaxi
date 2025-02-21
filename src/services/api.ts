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
    const {data, error} = await supabase
      .from('trip_requests')
      .insert([
        {
          ...requestData,
          status: 'broadcasting', // Aseguramos que el estado sea 'broadcasting'
        },
      ])
      .select();

    if (error) throw error;
    return data;
  },

  // Modificar el método para obtener solicitudes pendientes
  async getDriverPendingRequests(driverId: string) {
    // Primero obtenemos la ubicación actual del chofer
    const {data: driverData, error: driverError} = await supabase
      .from('driver_profiles')
      .select('latitude, longitude')
      .eq('id', driverId)
      .single();

    if (driverError) throw driverError;
    if (!driverData?.latitude || !driverData?.longitude) {
      console.log('Chofer sin ubicación actualizada');
      return [];
    }

    // Usamos la función get_nearby_requests para obtener solicitudes cercanas
    const {data, error} = await supabase
      .from('trip_requests')
      .select(
        `
        *,
        operator:operator_id (
          first_name,
          last_name
        )
      `,
      )
      .eq('status', 'broadcasting');

    if (error) {
      console.error('Error al obtener solicitudes:', error);
      throw error;
    }

    // Filtramos las solicitudes por distancia
    const nearbyRequests = data?.filter(request => {
      const distance = this.calculateDistance(
        driverData.latitude,
        driverData.longitude,
        request.origin_lat,
        request.origin_lng,
      );
      return distance <= request.search_radius;
    });

    return nearbyRequests || [];
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

  async updateRequestStatus(requestId: string, status: string) {
    const {data, error} = await supabase
      .from('trip_requests')
      .update({status})
      .eq('id', requestId)
      .select();

    if (error) throw error;
    return data;
  },

  async convertRequestToTrip(requestId: string) {
    // First get the full request details
    const {data: request, error: requestError} = await supabase
      .from('trip_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError) throw requestError;

    // Include all location data in tripData
    const tripData = {
      driver_id: request.driver_id,
      operator_id: request.operator_id,
      origin: request.origin,
      destination: request.destination,
      origin_lat: request.origin_lat,
      origin_lng: request.origin_lng,
      destination_lat: request.destination_lat,
      destination_lng: request.destination_lng,
      price: request.price,
      status: 'in_progress',
    };

    const {data: trip, error: tripError} = await supabase
      .from('trips')
      .insert(tripData)
      .select('*')
      .single();

    if (tripError) throw tripError;
    return trip;
  },

  async updateTripStatus(tripId: string, status: string) {
    const {data, error} = await supabase
      .from('trips')
      .update({status})
      .eq('id', tripId)
      .select('*') // Add this to return the updated trip
      .single();

    if (error) throw error;
    return data;
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

  async updateDutyStatus(driverId: string, isOnDuty: boolean) {
    const {data, error} = await supabase
      .from('driver_profiles')
      .update({
        is_on_duty: isOnDuty,
        last_duty_change: new Date().toISOString(),
      })
      .eq('id', driverId)
      .single();

    if (error) throw error;
    return data;
  },

  async getAvailableDrivers() {
    const {data, error} = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('is_on_duty', true);

    if (error) throw error;
    return data;
  },
  async getDriverProfile(driverId: string): Promise<DriverProfile> {
    const {data, error} = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('id', driverId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Perfil de conductor no encontrado');

    return data;
  },

  async updateBalance(driverId: string, amount: number) {
    const {data, error} = await supabase
      .from('driver_profiles')
      .update({
        balance: supabase.rpc('increment_balance', {
          row_id: driverId,
          amount: amount,
        }),
      })
      .eq('id', driverId)
      .single();

    if (error) throw error;
    return data;
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
      .single();

    if (error) throw error;
    return data;
  },

  async getDriverTrips(driverId: string) {
    const {data, error} = await supabase
      .from('trips')
      .select('*')
      .eq('driver_id', driverId);

    if (error) throw error;
    return data;
  },

  async getOperatorTrips(operatorId: string) {
    const {data, error} = await supabase
      .from('trips')
      .select('*')
      .eq('operator_id', operatorId);

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
};
