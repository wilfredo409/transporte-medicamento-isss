-- 1. TABLAS MAESTRAS (Correcciones SV1, SV2, SV3, SV5)
CREATE TABLE roles (id SERIAL PRIMARY KEY, nombre_rol VARCHAR(50));
INSERT INTO roles (nombre_rol) VALUES ('FARMACIA'), ('TRANSPORTISTA'), ('RECEPTOR'), ('GERENTE'), ('ADMIN');

CREATE TABLE estados_orden (id SERIAL PRIMARY KEY, nombre_estado VARCHAR(50));
INSERT INTO estados_orden (nombre_estado) VALUES ('EN_PREPARACION'), ('EN_RUTA'), ('ENTREGADO'), ('INCIDENCIA');

CREATE TABLE unidades_medicas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    departamento VARCHAR(50),
    municipio VARCHAR(50)
);

-- 2. TABLA DE USUARIOS CON LOGIN (Corrección SV1, SV6)
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(150),
    email VARCHAR(100) UNIQUE,
    password_text VARCHAR(100), -- En un sistema real se encripta, aquí es para el ejemplo
    role_id INTEGER REFERENCES roles(id),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA DE MEDICAMENTOS (Corrección SV4)
CREATE TABLE medicamentos (
    id SERIAL PRIMARY KEY,
    nombre_generico VARCHAR(150),
    requiere_frio BOOLEAN,
    activo BOOLEAN DEFAULT true
);

-- 4. TABLA DE ORDENES (Trazabilidad)
CREATE TABLE ordenes_envio (
    id SERIAL PRIMARY KEY,
    codigo_trz VARCHAR(20) UNIQUE,
    unidad_destino_id INTEGER REFERENCES unidades_medicas(id),
    transportista_id INTEGER REFERENCES usuarios(id),
    estado_id INTEGER REFERENCES estados_orden(id) DEFAULT 1,
    creador_id INTEGER REFERENCES usuarios(id),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DATOS DE PRUEBA PARA QUE EL LOGIN FUNCIONE
INSERT INTO unidades_medicas (nombre, departamento, municipio) VALUES ('Farmacia Central', 'San Salvador', 'San Salvador'), ('Hospital Sta Ana', 'Santa Ana', 'Santa Ana');
INSERT INTO usuarios (nombre_completo, email, password_text, role_id) VALUES 
('Ana Farmacia', 'farmacia@isss.gob.sv', '123456', 1),
('Juan Transportista', 'trans@isss.gob.sv', '123456', 2),
('Gerente Miranda', 'gerente@isss.gob.sv', '123456', 4);

-- Borrar datos viejos para no tener errores
TRUNCATE usuarios, unidades_medicas, estados_orden, roles RESTART IDENTITY CASCADE;

-- 1. Roles
INSERT INTO roles (nombre_rol) VALUES ('FARMACIA'), ('TRANSPORTISTA'), ('RECEPTOR'), ('GERENTE'), ('ADMIN');

-- 2. Estados
INSERT INTO estados_orden (nombre_estado) VALUES ('EN_PREPARACION'), ('EN_RUTA'), ('ENTREGADO'), ('INCIDENCIA');

-- 3. Unidades Médicas
INSERT INTO unidades_medicas (nombre, departamento, municipio) VALUES 
('Farmacia Central ISSS', 'San Salvador', 'San Salvador'),
('Hospital Regional Santa Ana', 'Santa Ana', 'Santa Ana'),
('Unidad Médica Sonsonate', 'Sonsonate', 'Sonsonate');

-- 4. Usuarios (Uno por cada rol)
INSERT INTO usuarios (nombre_completo, email, password_text, role_id) VALUES 
('Ana Despacho', 'farmacia@isss.gob.sv', '123456', 1),
('Juan Chofer', 'trans@isss.gob.sv', '123456', 2),
('Dr. Rivas', 'receptor@isss.gob.sv', '123456', 3),
('Lic. Miranda', 'gerente@isss.gob.sv', '123456', 4),
('Admin Sistema', 'admin@isss.gob.sv', 'admin123', 5);
