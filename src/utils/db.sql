-- aqui estan las consultas de crear tabla


-- Tabla de usuarios (sin cambios)
create table users (
  id uuid default uuid_generate_v4() primary key,
  phone_number text unique not null,
  pin varchar(6) not null,
  role text check (role in ('admin', 'operador', 'chofer')) not null,
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabla de perfiles de choferes (actualizada)
create table driver_profiles (
  id uuid references users(id) primary key,
  first_name text not null,
  last_name text not null,
  license_number text unique not null,
  phone_number text not null,
  vehicle text not null,
  balance decimal default 0,
  is_on_duty boolean default false,  -- Indica si el chofer está en servicio
  last_duty_change timestamp with time zone,  -- Registra la última vez que cambió su estado
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  vehicle_type text CHECK (vehicle_type IN ('2_ruedas', '4_ruedas')) NOT NULL DEFAULT '4_ruedas'
);

-- Tabla de perfiles de operadores (sin cambios)
create table operator_profiles (
  id uuid references users(id) primary key,
  first_name text not null,
  last_name text not null,
  identity_card text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabla de viajes (sin cambios)
create table trips (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  driver_id uuid REFERENCES driver_profiles(id),
  created_by uuid REFERENCES users(id),
  origin text NOT NULL,
  destination text NOT NULL,
  origin_lat decimal NOT NULL,
  origin_lng decimal NOT NULL,
  destination_lat decimal NOT NULL,
  destination_lng decimal NOT NULL,
  status text CHECK (status IN ('pending', 'in_progress', 'pickup_reached', 'completed', 'cancelled')) DEFAULT 'pending',
  price decimal NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at timestamp with time zone,
  passenger_phone text
);

-- Agregar tabla para el historial de balance
CREATE TABLE balance_history (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  driver_id uuid REFERENCES driver_profiles(id) NOT NULL,
  amount decimal NOT NULL,
  type text CHECK (type IN ('recarga', 'descuento', 'viaje')) NOT NULL,
  description text NOT NULL,
  created_by uuid REFERENCES users(id) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_balance_history_driver_id ON balance_history(driver_id);
CREATE INDEX idx_balance_history_created_at ON balance_history(created_at);

-- consultas para crear usuarios 



-- Crear usuario administrador (no requiere perfil adicional)
insert into users (id, phone_number, pin, role)
values (
  uuid_generate_v4(),
  '+51999888555',
  '123456',
  'admin'
);

-- Crear usuario operador y su perfil
with new_operator as (
  insert into users (id, phone_number, pin, role)
  values (
    uuid_generate_v4(),
    '+51999888777',
    '123456',
    'operador'
  )
  returning id
)
insert into operator_profiles (id, first_name, last_name, identity_card)
select id, 'Juan', 'Pérez', 'DNI123456'
from new_operator;

-- Crear usuario chofer y su perfil
with new_driver as (
  insert into users (id, phone_number, pin, role)
  values (
    uuid_generate_v4(),
    '+51999888666',
    '123456',
    'chofer'
  )
  returning id
)
insert into driver_profiles (id, first_name, last_name, license_number, phone_number, vehicle, vehicle_type)
select id, 'Carlos', 'García', 'LIC789012', '+51999888666', 'Toyota Corolla', '4_ruedas'
from new_driver;

-- Agregar columna passenger_phone a la tabla trip_requests
ALTER TABLE trip_requests 
ADD COLUMN passenger_phone text;

-- Primero, si existe la restricción foreign key anterior, la eliminamos
ALTER TABLE trip_requests 
DROP CONSTRAINT IF EXISTS trip_requests_operator_id_fkey;

-- Renombramos operator_id a created_by y actualizamos la foreign key para apuntar a users
ALTER TABLE trip_requests 
RENAME COLUMN operator_id TO created_by;

ALTER TABLE trip_requests
ADD CONSTRAINT trip_requests_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES users(id);

-- Crear índice para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_trip_requests_created_by 
ON trip_requests(created_by);

-- Modificamos la función get_nearby_requests para reflejar el cambio
CREATE OR REPLACE FUNCTION get_nearby_requests(
  driver_latitude decimal,
  driver_longitude decimal,
  p_driver_id uuid,
  p_vehicle_type text
)
RETURNS TABLE (
  id uuid,
  created_by uuid,
  origin text,
  destination text,
  price decimal,
  distance float,
  vehicle_type text,
  creator_role text,
  creator_first_name text,
  creator_last_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.created_by,
    r.origin,
    r.destination,
    r.price,
    calculate_distance(
      driver_latitude,
      driver_longitude,
      r.origin_lat,
      r.origin_lng
    ) as distance,
    r.vehicle_type,
    u.role as creator_role,
    COALESCE(op.first_name, ap.first_name) as creator_first_name,
    COALESCE(op.last_name, ap.last_name) as creator_last_name
  FROM trip_requests r
  INNER JOIN users u ON r.created_by = u.id
  LEFT JOIN operator_profiles op ON r.created_by = op.id
  LEFT JOIN admin_profiles ap ON r.created_by = ap.id
  WHERE 
    r.status = 'broadcasting'
    AND r.vehicle_type = p_vehicle_type
    AND calculate_distance(
      driver_latitude,
      driver_longitude,
      r.origin_lat,
      r.origin_lng
    ) <= r.search_radius
    AND u.role IN ('admin', 'operador')
  ORDER BY distance ASC;
END;
$$ LANGUAGE plpgsql;

-- Crear índice para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_trips_created_by ON trips(created_by);

-- Actualizar la función convert_request_to_trip
CREATE OR REPLACE FUNCTION convert_request_to_trip(request_id uuid)
RETURNS trips AS $$
DECLARE
  new_trip trips;
  request_data trip_requests;
BEGIN
  -- Obtener los datos de la solicitud
  SELECT * INTO request_data
  FROM trip_requests
  WHERE id = request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;

  -- Insertar el nuevo viaje con todos los datos necesarios
  INSERT INTO trips (
    driver_id,
    created_by,
    origin,
    destination,
    origin_lat,
    origin_lng,
    destination_lat,
    destination_lng,
    price,
    status,
    passenger_phone
  )
  VALUES (
    request_data.driver_id,
    request_data.created_by,
    request_data.origin,
    request_data.destination,
    request_data.origin_lat,
    request_data.origin_lng,
    request_data.destination_lat,
    request_data.destination_lng,
    request_data.price,
    'in_progress'::text,
    request_data.passenger_phone
  )
  RETURNING *
  INTO new_trip;

  -- Actualizar el estado de la solicitud
  UPDATE trip_requests 
  SET status = 'accepted'
  WHERE id = request_id;

  RETURN new_trip;
END;
$$ LANGUAGE plpgsql;

-- Función para incrementar/decrementar el balance del conductor
CREATE OR REPLACE FUNCTION increment_driver_balance(
  driver_id uuid,
  amount decimal
) RETURNS void AS $$
BEGIN
  UPDATE driver_profiles
  SET balance = balance + amount
  WHERE id = driver_id;
END;
$$ LANGUAGE plpgsql;

-- Tabla para almacenar las paradas de los viajes
CREATE TABLE trip_stops (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  trip_request_id uuid REFERENCES trip_requests(id) ON DELETE CASCADE,
  name text NOT NULL,
  latitude decimal NOT NULL,
  longitude decimal NOT NULL,
  order_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear índice para mejorar el rendimiento
CREATE INDEX idx_trip_stops_trip_request ON trip_stops(trip_request_id);

-- Primero eliminar el constraint existente si existe
ALTER TABLE trip_requests 
DROP CONSTRAINT IF EXISTS trip_requests_status_check;

-- Actualizar registros existentes a un estado válido
UPDATE trip_requests
SET status = 'broadcasting'
WHERE status NOT IN ('broadcasting', 'pending_acceptance', 'accepted', 'cancelled');

-- Luego modificar la columna y agregar el nuevo constraint
ALTER TABLE trip_requests 
ALTER COLUMN status TYPE text;

ALTER TABLE trip_requests
ADD CONSTRAINT trip_requests_status_check 
CHECK (status IN ('broadcasting', 'pending_acceptance', 'accepted', 'cancelled'));

-- Solo mantener la columna del conductor que intenta aceptar
ALTER TABLE trip_requests
ADD COLUMN IF NOT EXISTS attempting_driver_id uuid REFERENCES driver_profiles(id);

-- Función para intentar aceptar un viaje
CREATE OR REPLACE FUNCTION attempt_accept_trip_request(
  p_request_id uuid,
  p_driver_id uuid
) RETURNS boolean AS $$
DECLARE
  v_request trip_requests;
BEGIN
  -- Obtener la solicitud con bloqueo exclusivo
  SELECT * INTO v_request
  FROM trip_requests
  WHERE id = p_request_id
  FOR UPDATE SKIP LOCKED;

  -- Validar estado actual
  IF v_request.status != 'broadcasting' THEN
    RETURN false;
  END IF;

  -- Actualizar estado y conductor que intenta aceptar
  UPDATE trip_requests
  SET 
    status = 'pending_acceptance',
    attempting_driver_id = p_driver_id
  WHERE id = p_request_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Función para confirmar la aceptación
CREATE OR REPLACE FUNCTION confirm_trip_request_acceptance(
  p_request_id uuid,
  p_driver_id uuid
) RETURNS trips AS $$
DECLARE
  v_request trip_requests;
  v_new_trip trips;
BEGIN
  -- Obtener la solicitud con bloqueo
  SELECT * INTO v_request
  FROM trip_requests
  WHERE id = p_request_id
  FOR UPDATE;

  -- Validar estado y conductor
  IF v_request.status != 'pending_acceptance' 
     OR v_request.attempting_driver_id != p_driver_id THEN
    RAISE EXCEPTION 'Solicitud no válida para confirmación';
  END IF;

  -- Convertir a viaje
  INSERT INTO trips (
    driver_id,
    created_by,
    origin,
    destination,
    origin_lat,
    origin_lng,
    destination_lat,
    destination_lng,
    price,
    status,
    passenger_phone
  )
  VALUES (
    p_driver_id,
    v_request.created_by,
    v_request.origin,
    v_request.destination,
    v_request.origin_lat,
    v_request.origin_lng,
    v_request.destination_lat,
    v_request.destination_lng,
    v_request.price,
    'in_progress',
    v_request.passenger_phone
  )
  RETURNING * INTO v_new_trip;

  -- Actualizar estado de la solicitud
  UPDATE trip_requests 
  SET status = 'accepted'
  WHERE id = p_request_id;

  RETURN v_new_trip;
END;
$$ LANGUAGE plpgsql;

-- Función para liberar una solicitud si algo falla
CREATE OR REPLACE FUNCTION release_trip_request(
  p_request_id uuid
) RETURNS void AS $$
BEGIN
  UPDATE trip_requests
  SET 
    status = 'broadcasting',
    attempting_driver_id = NULL
  WHERE id = p_request_id
  AND status = 'pending_acceptance';
END;
$$ LANGUAGE plpgsql;