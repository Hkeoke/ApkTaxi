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
  completed_at timestamp with time zone
);

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

-- Agregar campo vehicle_type a la tabla trip_requests
ALTER TABLE trip_requests 
ADD COLUMN vehicle_type text CHECK (vehicle_type IN ('2_ruedas', '4_ruedas')) NOT NULL DEFAULT '4_ruedas';

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
    status
  )
  VALUES (
    request_data.driver_id,  -- Usar el driver_id de la solicitud
    request_data.created_by,
    request_data.origin,
    request_data.destination,
    request_data.origin_lat,
    request_data.origin_lng,
    request_data.destination_lat,
    request_data.destination_lng,
    request_data.price,
    'in_progress'::text
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
  SET balance = balance + amount  -- amount será negativo cuando es una deducción
  WHERE id = driver_id;
END;
$$ LANGUAGE plpgsql;