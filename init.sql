-- 1. Tabla para almacenar el catálogo de plantas identificadas con la cámara
CREATE TABLE IF NOT EXISTS identified_plants (
    id SERIAL PRIMARY KEY,
    plant_name VARCHAR(255) NOT NULL,
    probability DECIMAL(5, 2),
    common_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla para almacenar las tareas de la agenda del calendario
CREATE TABLE IF NOT EXISTS plant_events (
    id SERIAL PRIMARY KEY,
    event_date DATE NOT NULL,
    plant_name VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    event_time VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla para persistir los push tokens de los dispositivos Android
CREATE TABLE IF NOT EXISTS device_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla para almacenar las recetas gastronómicas/médicas procesadas por la IA
CREATE TABLE IF NOT EXISTS recipes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    instructions TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabla intermedia relacional para el borrado en cascada solicitado
CREATE TABLE IF NOT EXISTS recipe_plants (
    recipe_id INT REFERENCES recipes(id) ON DELETE CASCADE,
    plant_id INT REFERENCES identified_plants(id) ON DELETE CASCADE,
    PRIMARY KEY (recipe_id, plant_id)
);

