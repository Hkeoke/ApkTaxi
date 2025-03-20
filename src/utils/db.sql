-- ==========================================
-- CREACIÓN DE TABLAS PRINCIPALES
-- ==========================================

-- Tabla de usuarios
CREATE TABLE users (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  phone_number text UNIQUE NOT NULL,
  pin varchar(6) NOT NULL,
  role text CHECK (role IN ('admin', 'operador', 'chofer')) NOT NULL,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de perfiles de choferes
CREATE TABLE driver_profiles (
  id uuid REFERENCES users(id) PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  license_number text UNIQUE NOT NULL,
  phone_number text NOT NULL,
  vehicle text NOT NULL,
  balance decimal DEFAULT 0,
  is_on_duty boolean DEFAULT false,
  last_duty_change timestamp with time zone,
  vehicle_type text CHECK (vehicle_type IN ('2_ruedas', '4_ruedas')) NOT NULL DEFAULT '4_ruedas',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  is_special boolean DEFAULT false,
  latitude decimal,
  longitude decimal,
  last_location_update timestamp with time zone
);

-- Tabla de perfiles de operadores
CREATE TABLE operator_profiles (
  id uuid REFERENCES users(id) PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  identity_card text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- TABLAS DE VIAJES Y SOLICITUDES
-- ==========================================

-- Tabla de viajes
CREATE TABLE trips (
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
  passenger_phone text,
  cancellation_reason text,
  cancelled_at timestamp with time zone,
  cancelled_by uuid REFERENCES users(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at timestamp with time zone
);

-- Tabla de solicitudes de viaje
CREATE TABLE trip_requests (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_by uuid REFERENCES users(id),
  origin text NOT NULL,
  destination text NOT NULL,
  origin_lat decimal NOT NULL,
  origin_lng decimal NOT NULL,
  destination_lat decimal NOT NULL,
  destination_lng decimal NOT NULL,
  price decimal NOT NULL,
  status text CHECK (status IN ('broadcasting', 'pending_acceptance', 'accepted', 'rejected', 'expired')) DEFAULT 'broadcasting',
  vehicle_type text CHECK (vehicle_type IN ('2_ruedas', '4_ruedas')) NOT NULL DEFAULT '4_ruedas',
  passenger_phone text,
  search_radius decimal DEFAULT 3000,
  attempting_driver_id uuid REFERENCES driver_profiles(id),
  cancelled_trip_id uuid REFERENCES trips(id),
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  current_radius decimal DEFAULT 3000,
  last_radius_update timestamp with time zone,
  notified_drivers uuid[] DEFAULT ARRAY[]::uuid[],
  observations text
);

-- Tabla de paradas de viaje
CREATE TABLE trip_stops (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  trip_request_id uuid REFERENCES trip_requests(id),
  name text NOT NULL,
  latitude decimal NOT NULL,
  longitude decimal NOT NULL,
  order_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- TABLA DE HISTORIAL DE BALANCE
-- ==========================================

CREATE TABLE balance_history (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  driver_id uuid REFERENCES driver_profiles(id) NOT NULL,
  amount decimal NOT NULL,
  type text CHECK (type IN ('recarga', 'descuento', 'viaje')) NOT NULL,
  description text NOT NULL,
  created_by uuid REFERENCES users(id) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- ÍNDICES
-- ==========================================

CREATE INDEX idx_balance_history_driver_id ON balance_history(driver_id);
CREATE INDEX idx_balance_history_created_at ON balance_history(created_at);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trip_requests_status ON trip_requests(status);
CREATE INDEX idx_trip_requests_expires_at ON trip_requests(expires_at);

-- ==========================================
-- ÍNDICES ADICIONALES RECOMENDADOS
-- ==========================================

-- Índices para búsquedas geoespaciales
CREATE INDEX idx_driver_profiles_location ON driver_profiles(latitude, longitude);
CREATE INDEX idx_trip_requests_origin ON trip_requests(origin_lat, origin_lng);
CREATE INDEX idx_trip_requests_destination ON trip_requests(destination_lat, destination_lng);

-- Índices para búsquedas frecuentes
CREATE INDEX idx_trips_driver_id ON trips(driver_id);
CREATE INDEX idx_trips_created_by ON trips(created_by);
CREATE INDEX idx_driver_profiles_vehicle_type ON driver_profiles(vehicle_type);
CREATE INDEX idx_driver_profiles_is_on_duty ON driver_profiles(is_on_duty);

-- ==========================================
-- FUNCIONES DE MANEJO DE SOLICITUDES
-- ==========================================

-- Función para intentar aceptar un viaje
CREATE OR REPLACE FUNCTION attempt_accept_trip_request(
  p_request_id uuid,
  p_driver_id uuid
) RETURNS boolean AS $$
DECLARE
  v_request trip_requests;
BEGIN
  SELECT * INTO v_request
  FROM trip_requests
  WHERE id = p_request_id
  AND expires_at > NOW()
  FOR UPDATE SKIP LOCKED;

  IF v_request.status != 'broadcasting' THEN
    RETURN false;
  END IF;

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
  SELECT * INTO v_request
  FROM trip_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.status != 'pending_acceptance' 
     OR v_request.attempting_driver_id != p_driver_id THEN
    RAISE EXCEPTION 'Solicitud no válida para confirmación';
  END IF;

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

  UPDATE trip_requests 
  SET status = 'accepted'
  WHERE id = p_request_id;

  RETURN v_new_trip;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNCIONES DE MANEJO DE EXPIRACIÓN
-- ==========================================

-- Función para limpiar solicitudes expiradas (corregida)
CREATE OR REPLACE FUNCTION cleanup_expired_requests() RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  -- Primero obtener todas las solicitudes que han expirado
  FOR r IN 
    SELECT * FROM trip_requests 
    WHERE status = 'broadcasting' 
    AND expires_at < NOW()
  LOOP
    -- Crear un viaje cancelado para cada solicitud expirada
    INSERT INTO trips (
      created_by,
      origin,
      destination,
      origin_lat,
      origin_lng,
      destination_lat,
      destination_lng,
      price,
      status,
      passenger_phone,
      cancellation_reason,
      cancelled_at
    ) VALUES (
      r.created_by,
      r.origin,
      r.destination,
      r.origin_lat,
      r.origin_lng,
      r.destination_lat,
      r.destination_lng,
      r.price,
      'cancelled',
      r.passenger_phone,
      'Solicitud expirada sin respuesta',
      NOW()
    );

    -- Actualizar el estado de la solicitud a expirada
    UPDATE trip_requests 
    SET status = 'expired'
    WHERE id = r.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Función para establecer tiempo de expiración
CREATE OR REPLACE FUNCTION set_request_expiration() RETURNS TRIGGER AS $$
BEGIN
  NEW.expires_at := NOW() + INTERVAL '10 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Trigger para establecer expiración automática
CREATE TRIGGER set_request_expiration_trigger
BEFORE INSERT ON trip_requests
FOR EACH ROW
EXECUTE FUNCTION set_request_expiration();

-- ==========================================
-- CONFIGURACIÓN DE REPLICACIÓN
-- ==========================================

-- Habilitar replicación para la tabla de viajes
ALTER TABLE trips REPLICA IDENTITY FULL;

-- Habilitar la publicación para la tabla de viajes
CREATE PUBLICATION trip_changes FOR TABLE trips;

-- ==========================================
-- FUNCIONES PARA MANEJO DE RADIO DINÁMICO
-- ==========================================

-- Función para obtener conductores disponibles en el radio actual
CREATE OR REPLACE FUNCTION get_available_drivers_in_radius(
  p_request_id uuid,
  p_latitude decimal,
  p_longitude decimal,
  p_radius decimal,
  p_vehicle_type text,
  p_special_only boolean DEFAULT false
) RETURNS TABLE (
  driver_id uuid,
  distance decimal
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    (
      6371000 * acos(
        cos(radians(p_latitude)) * 
        cos(radians(d.latitude::numeric)) * 
        cos(radians(d.longitude::numeric) - radians(p_longitude)) + 
        sin(radians(p_latitude)) * 
        sin(radians(d.latitude::numeric))
      )
    ) as distance
  FROM driver_profiles d
  WHERE d.is_on_duty = true
  AND d.vehicle_type = p_vehicle_type
  AND d.id NOT IN (
    SELECT unnest(tr.notified_drivers)
    FROM trip_requests tr
    WHERE tr.id = p_request_id
  )
  AND (p_special_only = false OR d.is_special = true)
  HAVING (
    6371000 * acos(
      cos(radians(p_latitude)) * 
      cos(radians(d.latitude::numeric)) * 
      cos(radians(d.longitude::numeric) - radians(p_longitude)) + 
      sin(radians(p_latitude)) * 
      sin(radians(d.latitude::numeric))
    )
  ) <= p_radius
  ORDER BY d.is_special DESC, distance;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar el radio de búsqueda
CREATE OR REPLACE FUNCTION update_search_radius() RETURNS void AS $$
DECLARE
  r RECORD;
  available_drivers integer;
  new_radius decimal;
BEGIN
  FOR r IN 
    SELECT * 
    FROM trip_requests 
    WHERE status = 'broadcasting'
    AND expires_at > NOW()
  LOOP
    -- Verificar si es momento de aumentar el radio
    IF r.last_radius_update IS NULL OR 
       NOW() - r.last_radius_update >= INTERVAL '1 minute'
    THEN
      -- Calcular nuevo radio
      new_radius := CASE
        WHEN r.current_radius < 5000 THEN 5000
        WHEN r.current_radius < 7000 THEN 7000
        WHEN r.current_radius < 10000 THEN 10000
        WHEN r.current_radius < 15000 THEN 15000
        ELSE r.current_radius
      END;

      -- Solo actualizar si el nuevo radio es diferente y no excede 15km
      IF new_radius <= 15000 AND new_radius != r.current_radius THEN
  UPDATE trip_requests
  SET 
          current_radius = new_radius,
          last_radius_update = NOW()
        WHERE id = r.id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Trigger para actualizar el radio cada minuto
CREATE OR REPLACE FUNCTION check_radius_update() RETURNS TRIGGER AS $$
BEGIN
  -- Si no hay conductores disponibles en el radio actual, aumentar inmediatamente
  IF NOT EXISTS (
    SELECT 1 
    FROM get_available_drivers_in_radius(
      NEW.id, 
      NEW.origin_lat, 
      NEW.origin_lng, 
      NEW.current_radius,
      NEW.vehicle_type
    )
  ) THEN
    NEW.current_radius := CASE
      WHEN NEW.current_radius < 5000 THEN 5000
      WHEN NEW.current_radius < 7000 THEN 7000
      WHEN NEW.current_radius < 10000 THEN 10000
      WHEN NEW.current_radius < 15000 THEN 15000
      ELSE NEW.current_radius
    END;
    NEW.last_radius_update := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_radius_update_trigger
BEFORE INSERT OR UPDATE ON trip_requests
FOR EACH ROW
EXECUTE FUNCTION check_radius_update();

-- ==========================================
-- PROGRAMAR ACTUALIZACIÓN AUTOMÁTICA
-- ==========================================

-- Crear un trabajo programado para ejecutar la actualización del radio
SELECT supabase_cron.schedule(
  'cleanup_and_update',  -- nombre único del trabajo
  '* * * * *',          -- programación (cada minuto)
  $$
    SELECT cleanup_expired_requests();
    SELECT update_search_radius();
  $$
);

-- ==========================================
-- RESTRICCIONES ADICIONALES
-- ==========================================

-- Asegurar que el precio sea positivo
ALTER TABLE trips ADD CONSTRAINT positive_price CHECK (price > 0);
ALTER TABLE trip_requests ADD CONSTRAINT positive_request_price CHECK (price > 0);

-- Asegurar que el radio de búsqueda sea válido
ALTER TABLE trip_requests ADD CONSTRAINT valid_radius CHECK (current_radius >= 3000 AND current_radius <= 15000);

-- ==========================================
-- COLUMNAS ADICIONALES ÚTILES
-- ==========================================

-- Agregar columnas para métricas
ALTER TABLE trips ADD COLUMN distance_km decimal;
ALTER TABLE trips ADD COLUMN duration_minutes integer;

-- Agregar columnas para auditoría
ALTER TABLE trips ADD COLUMN updated_at timestamp with time zone DEFAULT now();
ALTER TABLE trip_requests ADD COLUMN updated_at timestamp with time zone DEFAULT now();

-- ==========================================
-- TRIGGER PARA ACTUALIZAR TIMESTAMP
-- ==========================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_trips_timestamp
    BEFORE UPDATE ON trips
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_requests_timestamp
    BEFORE UPDATE ON trip_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- ==========================================
-- PERMISOS DE BASE DE DATOS
-- ==========================================

-- Asegurar que la extensión pgcrypto esté instalada para UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Asegurar que la extensión para trabajos programados esté instalada
CREATE EXTENSION IF NOT EXISTS "supabase_cron";

-- ==========================================
-- FUNCIÓN DE LIMPIEZA DE TABLAS
-- ==========================================

CREATE OR REPLACE FUNCTION cleanup_old_data() RETURNS void AS $$
BEGIN
    -- Eliminar solicitudes de viaje antiguas (más de 24 horas)
    DELETE FROM trip_requests 
    WHERE created_at < NOW() - INTERVAL '24 hours'
    AND status IN ('expired', 'rejected', 'accepted');

    -- Eliminar paradas de viaje huérfanas o antiguas
    DELETE FROM trip_stops 
    WHERE created_at < NOW() - INTERVAL '24 hours'
    OR trip_request_id IN (
        SELECT id 
        FROM trip_requests 
        WHERE status IN ('expired', 'rejected', 'accepted')
    );

    -- Aquí puedes agregar más tablas para limpiar si es necesario
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- PROGRAMAR LIMPIEZA AUTOMÁTICA
-- ==========================================

-- Programar la limpieza para que se ejecute todos los días a las 3 AM
-- El formato es: minuto hora * * * (minuto 0-59, hora 0-23, día del mes, mes, día de la semana)
SELECT supabase_cron.schedule(
  'daily_cleanup',      -- nombre único del trabajo
  '0 3 * * *',         -- programación (3 AM todos los días)
  $$
    SELECT cleanup_old_data();
  $$
);

-- ==========================================
-- FUNCIÓN PARA CONVERTIR SOLICITUD A VIAJE
-- ==========================================

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

-- ==========================================
-- FUNCIÓN PARA INCREMENTAR BALANCE DE CONDUCTOR
-- ==========================================

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

-- ==========================================
-- FUNCIÓN PARA LIBERAR SOLICITUD DE VIAJE
-- ==========================================

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

-- ==========================================
-- TRIGGERS Y FUNCIONES ADICIONALES
-- ==========================================

-- Trigger para actualizar el último cambio de estado de servicio
CREATE OR REPLACE FUNCTION update_duty_change() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_on_duty IS DISTINCT FROM NEW.is_on_duty THEN
    NEW.last_duty_change = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_duty_change_trigger
BEFORE UPDATE ON driver_profiles
FOR EACH ROW
EXECUTE FUNCTION update_duty_change();

-- Trigger para validar balance antes de actualizar
CREATE OR REPLACE FUNCTION validate_balance_update() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.balance < 0 THEN
    RAISE EXCEPTION 'El balance no puede ser negativo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_balance_trigger
BEFORE UPDATE OF balance ON driver_profiles
FOR EACH ROW
EXECUTE FUNCTION validate_balance_update();

-- ==========================================
-- TRIGGERS ADICIONALES
-- ==========================================

-- Trigger para actualizar el estado de la solicitud
CREATE OR REPLACE FUNCTION update_request_status() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.driver_id IS NOT NULL AND OLD.driver_id IS NULL THEN
    NEW.status = 'pending_acceptance';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar el estado del conductor
CREATE OR REPLACE FUNCTION update_driver_status() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_progress' THEN
    UPDATE driver_profiles SET is_on_duty = false WHERE id = NEW.driver_id;
  ELSIF NEW.status = 'completed' OR NEW.status = 'cancelled' THEN
    UPDATE driver_profiles SET is_on_duty = true WHERE id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar el radio de búsqueda
CREATE OR REPLACE FUNCTION validate_search_radius() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_radius < 3000 OR NEW.current_radius > 15000 THEN
    RAISE EXCEPTION 'El radio de búsqueda debe estar entre 3000 y 15000 metros';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para limpiar notificaciones
CREATE OR REPLACE FUNCTION cleanup_notifications() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != 'broadcasting' THEN
    NEW.notified_drivers = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar el historial de balance
CREATE OR REPLACE FUNCTION update_balance_history() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.balance != OLD.balance THEN
    INSERT INTO balance_history (
      driver_id,
      amount,
      type,
      description
    ) VALUES (
      NEW.id,
      NEW.balance - OLD.balance,
      CASE 
        WHEN NEW.balance > OLD.balance THEN 'recarga'
        ELSE 'descuento'
      END,
      'Actualización automática de balance'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- INSERCIÓN DE USUARIOS INICIALES
-- ==========================================

-- Crear Administrador
INSERT INTO users (
  phone_number,
  pin,
  role,
  active
) VALUES (
  '999999999',
  '123456',
  'admin',
  true
);

-- Crear Operador
WITH new_operator AS (
  INSERT INTO users (
    phone_number,
    pin,
    role,
    active
  ) VALUES (
    '888888888',
    '123456',
    'operador',
    true
  ) RETURNING id
)
INSERT INTO operator_profiles (
  id,
  first_name,
  last_name,
  identity_card
) SELECT 
  id,
  'Juan',
  'Operador',
  'OP123456'
FROM new_operator;

-- Crear Chofer Regular
WITH new_driver AS (
  INSERT INTO users (
    phone_number,
    pin,
    role,
    active
  ) VALUES (
    '777777777',
    '123456',
    'chofer',
    true
  ) RETURNING id
)
INSERT INTO driver_profiles (
  id,
  first_name,
  last_name,
  license_number,
  phone_number,
  vehicle,
  vehicle_type,
  is_special
) SELECT
  id,
  'Pedro',
  'Conductor',
  'LIC123456',
  '777777777',
  'Toyota Corolla',
  '4_ruedas',
  false
FROM new_driver;

-- Crear Chofer Especial
WITH new_special_driver AS (
  INSERT INTO users (
    phone_number,
    pin,
    role,
    active
  ) VALUES (
    '666666666',
    '123456',
    'chofer',
    true
  ) RETURNING id
)
INSERT INTO driver_profiles (
  id,
  first_name,
  last_name,
  license_number,
  phone_number,
  vehicle,
  vehicle_type,
  is_special
) SELECT
  id,
  'María',
  'Conductora',
  'LIC654321',
  '666666666',
  'Honda Civic',
  '4_ruedas',
  true
FROM new_special_driver;