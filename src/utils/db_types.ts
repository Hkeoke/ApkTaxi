export type Role = 'admin' | 'operador' | 'chofer';
export type TripStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type VehicleType = '2_ruedas' | '4_ruedas';

export interface User {
  id: string;
  phone_number: string;
  pin: string;
  role: Role;
  active: boolean;
  created_at: string;
  driver_profiles: DriverProfile;
  operator_profiles: OperatorProfile;
}

export interface DriverProfile {
  id: string;
  first_name: string;
  last_name: string;
  license_number: string;
  phone_number: string;
  vehicle: string;
  vehicle_type: VehicleType;
  balance: number;
  is_on_duty: boolean;
  last_duty_change: string | null;
  created_at: string;
}

export interface OperatorProfile {
  id: string;
  first_name: string;
  last_name: string;
  identity_card: string;
  created_at: string;
}

export interface Trip {
  id: string;
  driver_id: string;
  operator_id: string;
  origin: string;
  destination: string;
  status: TripStatus;
  price: number;
  created_at: string;
  completed_at: string | null;
}
