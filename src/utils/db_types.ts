export type Role = 'admin' | 'operador' | 'chofer';
export type TripStatus =
  | 'pending'
  | 'in_progress'
  | 'pickup_reached'
  | 'completed'
  | 'cancelled';
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
  pin?: string;
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
  created_by: string;
  origin: string;
  destination: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  status: TripStatus;
  price: number;
  completed_at?: string;
}

export type BalanceOperationType = 'recarga' | 'descuento' | 'viaje';

export interface BalanceHistory {
  id: string;
  driver_id: string;
  amount: number;
  type: BalanceOperationType;
  description: string;
  created_by: string;
  created_at: string;
}
