import Fastify from 'fastify';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from '@fastify/cors';
import pg from 'pg';

dotenv.config();
const fastify = Fastify({ logger: true });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

await fastify.register(cors, { 
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE']
});

// --- ENDPOINTS ANTERIORES (CÁMARA) ---

fastify.post('/identify-plant', async (request, reply) => {
  const { image } = request.body;
  if (!image) return reply.status(400).send({ error: 'La imagen es requerida' });
  try {
    const response = await axios.post('https://api.plant.id/v2/identify', {
      images: [image],
      modifiers: ["crops_fast", "similar_images"],
      plant_details: ["common_names", "url", "taxonomy", "watering"],
    }, {
      headers: { 'Api-Key': process.env.PLANTID_API_KEY }
    });
    return response.data;
  } catch (error) {
    return reply.status(500).send({ error: 'Error al identificar la planta' });
  }
});

fastify.post('/save-plant', async (request, reply) => {
  const { plant_name, probability, common_name } = request.body;
  if (!plant_name) return reply.status(400).send({ error: 'El nombre es requerido' });
  try {
    const query = `INSERT INTO identified_plants (plant_name, probability, common_name) VALUES ($1, $2, $3) RETURNING *;`;
    const result = await pool.query(query, [plant_name, probability, common_name]);
    return reply.status(201).send({ success: true, data: result.rows[0] });
  } catch (error) {
    return reply.status(500).send({ error: 'Error al guardar la planta' });
  }
});


// --- 🟢 NUEVOS ENDPOINTS (CALENDARIO Y SINCRONIZACIÓN) ---

// 1. Obtener la lista única de plantas guardadas para los inputs/chips
fastify.get('/plants', async (request, reply) => {
  try {
    // Usamos COALESCE para priorizar el nombre común si existe, sino el científico
    const query = `
      SELECT DISTINCT COALESCE(common_name, plant_name) AS name 
      FROM identified_plants 
      ORDER BY name ASC;
    `;
    const result = await pool.query(query);
    const plantNames = result.rows.map(row => row.name);
    return plantNames; 
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Error al obtener las plantas' });
  }
});

// 2. Obtener todos los eventos del calendario
fastify.get('/events', async (request, reply) => {
  try {
    const query = `
      SELECT id, to_char(event_date, 'YYYY-MM-DD') as event_date, plant_name, action, event_time, notes 
      FROM plant_events 
      ORDER BY event_time ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Error al obtener los eventos' });
  }
});

// 3. Crear un nuevo evento en el calendario
fastify.post('/events', async (request, reply) => {
  const { event_date, plant_name, action, event_time, notes } = request.body;

  if (!event_date || !plant_name || !action || !event_time) {
    return reply.status(400).send({ error: 'Faltan campos obligatorios' });
  }

  try {
    const query = `
      INSERT INTO plant_events (event_date, plant_name, action, event_time, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, to_char(event_date, 'YYYY-MM-DD') as event_date, plant_name, action, event_time, notes;
    `;
    const values = [event_date, plant_name, action, event_time, notes || null];
    const result = await pool.query(query, values);

    return reply.status(201).send({ success: true, data: result.rows[0] });
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Error al crear el evento' });
  }
});

 // --- 🟢 NUEVO: REGISTRAR TOKEN DE EXPO ---
fastify.post('/register-token', async (request, reply) => {
  const { token } = request.body;
  if (!token) return reply.status(400).send({ error: 'Token requerido' });

  try {
    // ON CONFLICT evita duplicar el token si el usuario abre la app varias veces
    const query = `
      INSERT INTO device_tokens (token) VALUES ($1)
      ON CONFLICT (token) DO NOTHING
      RETURNING *;
    `;
    await pool.query(query, [token]);
    return { success: true, message: 'Token registrado exitosamente' };
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Error al registrar token' });
  }
});


// --- 🟢 NUEVO: SISTEMA DE ENVÍO DE NOTIFICACIONES EN SEGUNDO PLANO ---

async function checkUpcomingEvents() {
  try {
    // 1. Obtener la fecha y hora actual formateada igual que en la DB (Ej: '2026-05-26' y '08:30 AM')
    const ahora = new Date();
    const fechaActual = ahora.toISOString().split('T')[0];
    const horaActual = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    fastify.log.info(`Buscando tareas para: ${fechaActual} a las ${horaActual}`);

    // 2. Buscar si hay eventos programados para este minuto exacto
    const queryEventos = `
      SELECT id, plant_name, action, notes 
      FROM plant_events 
      WHERE to_char(event_date, 'YYYY-MM-DD') = $1 AND event_time = $2;
    `;
    const resultEventos = await pool.query(queryEventos, [fechaActual, horaActual]);

    if (resultEventos.rows.length === 0) return; // No hay eventos en este minuto

    // 3. Obtener todos los dispositivos registrados a los cuales notificar
    const resultTokens = await pool.query('SELECT token FROM device_tokens');
    const tokens = resultTokens.rows.map(row => row.token);

    if (tokens.length === 0) return;

    // 4. Construir y enviar las notificaciones hacia la API de Expo
    for (const evento of resultEventos.rows) {
      for (const token of tokens) {
        try {
          await axios.post('https://exp.host/--/api/v2/push/send', {
            to: token,
            sound: 'default',
            title: `¡Hora de cuidar tus plantas! 🌱`,
            body: `${evento.action} para tu ${evento.plant_name}. ${evento.notes ? 'Nota: ' + evento.notes : ''}`,
            channelId: 'alertas-backend', // Obligatorio para Android
          });
          fastify.log.info(`Notificación enviada para el evento ID: ${evento.id}`);
        } catch (err) {
          fastify.log.error(`Error enviando push a token: ${token}`);
        }
      }
    }
  } catch (error) {
    fastify.log.error('Error en el cron de notificaciones:', error);
  }
}

// Ejecutar la revisión de eventos en segundo plano cada 60 segundos
setInterval(checkUpcomingEvents, 60000);


// 1. Obtener listado de plantas con ID para la pantalla de recetas
fastify.get('/plants-detailed', async (request, reply) => {
  try {
    const result = await pool.query(`
      SELECT id, COALESCE(common_name, plant_name) AS name 
      FROM identified_plants 
      ORDER BY id DESC;
    `);
    return result.rows;
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Error al cargar plantas' });
  }
});

// 2. Generar receta con Gemini y guardarla de forma relacional
fastify.post('/generate-recipes', async (request, reply) => {
  const { plant_ids } = request.body;

  if (!plant_ids || plant_ids.length === 0) {
    return reply.status(400).send({ error: 'Selecciona al menos una planta.' });
  }

  try {
    // Buscar los nombres de las plantas seleccionadas
    const plantsQuery = await pool.query(
      'SELECT COALESCE(common_name, plant_name) as name FROM identified_plants WHERE id = ANY($1)',
      [plant_ids]
    );
    const listaPlantas = plantsQuery.rows.map(p => p.name).join(', ');

    const prompt = `
    Actúa como un chef profesional y botánico medicinal. Crea una receta saludable, platillo o infusión utilizando de forma segura los siguientes ingredientes: ${listaPlantas}.
    Puedes asumir ingredientes básicos comunes de despensa.
    
    IMPORTANTE: Responde UNICAMENTE un objeto JSON estructurado, sin textos extras fuera del JSON.
    {
      "title": "Nombre de la receta",
      "recipe": "Instrucciones detalladas de preparación..."
    }
    `;

    // Endpoint oficial v1beta de Gemini (siguiendo tu arquitectura estructurada)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }]
    };

    const res = await axios.post(url, payload);
    const rawText = res.data.candidates[0].content.parts[0].text;
    const cleaned = limpiarJson(rawText);
    const parsed = JSON.parse(cleaned);

    // Guardar en la base de datos la receta resultante
    const insertRecipe = await pool.query(
      'INSERT INTO recipes (title, instructions) VALUES ($1, $2) RETURNING id, title, instructions',
      [parsed.title, parsed.recipe]
    );
    const newRecipeId = insertRecipe.rows[0].id;

    // Guardar las relaciones en la tabla intermedia
    for (const plantId of plant_ids) {
      await pool.query('INSERT INTO recipe_plants (recipe_id, plant_id) VALUES ($1, $2)', [newRecipeId, plantId]);
    }

    return { success: true, recipe: insertRecipe.rows[0].instructions };

  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Error al procesar la receta con Gemini' });
  }
});

// 3. Eliminar Planta y sus recetas asociadas de manera segura
fastify.delete('/plants/:id', async (request, reply) => {
  const { id } = request.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Encontrar las recetas asociadas a esta planta antes de borrar la relación
    const findRecipes = await client.query('SELECT recipe_id FROM recipe_plants WHERE plant_id = $1', [id]);
    const recipeIds = findRecipes.rows.map(r => r.recipe_id);

    // 2. Borrar la planta de la tabla maestra (Esto limpia automáticamente recipe_plants por el CASCADE)
    await client.query('DELETE FROM identified_plants WHERE id = $1', [id]);

    // 3. Eliminar las recetas maestras que quedaron huérfanas
    if (recipeIds.length > 0) {
      await client.query('DELETE FROM recipes WHERE id = ANY($1)', [recipeIds]);
    }

    await client.query('COMMIT');
    return { success: true, message: 'Planta y recetas asociadas eliminadas' };
  } catch (error) {
    await client.query('ROLLBACK');
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Error en la transacción de borrado' });
  } finally {
    client.release();
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
  } catch (err) {
    process.exit(1);
  }
};
start();