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
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
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
  id uuid default uuid_generate_v4() primary key,
  driver_id uuid references driver_profiles(id),
  operator_id uuid references operator_profiles(id),
  origin text not null,
  destination text not null,
  status text check (status in ('pending', 'in_progress', 'completed', 'cancelled')) default 'pending',
  price decimal not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
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
insert into driver_profiles (id, first_name, last_name, license_number, phone_number, vehicle)
select id, 'Carlos', 'García', 'LIC789012', '+51999888666', 'Toyota Corolla'
from new_driver;