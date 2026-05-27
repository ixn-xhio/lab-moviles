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

// 🟢 FUNCIÓN SELECTORA Y LIMPIADORA DE JSON (Corregida e inmune a fallos de markdown de Gemini)
function limpiarJson(text) {
  const match = text.match(/```json([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim().replace(/```json/g, "").replace(/```/g, "").trim();
}

// --- ENDPOINTS DE LA CÁMARA ---

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

// --- ENDPOINTS DEL CALENDARIO ---

fastify.get('/plants', async (request, reply) => {
  try {
    const query = `
      SELECT DISTINCT COALESCE(common_name, plant_name) AS name 
      FROM identified_plants 
      ORDER BY name ASC;
    `;
    const result = await pool.query(query);
    return result.rows.map(row => row.name); 
  } catch (error) {
    return reply.status(500).send({ error: 'Error al obtener las plantas' });
  }
});

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
    return reply.status(500).send({ error: 'Error al obtener los eventos' });
  }
});

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
    const result = await pool.query(query, [event_date, plant_name, action, event_time, notes || null]);
    return reply.status(201).send({ success: true, data: result.rows[0] });
  } catch (error) {
    return reply.status(500).send({ error: 'Error al crear el evento' });
  }
});

fastify.post('/register-token', async (request, reply) => {
  const { token } = request.body;
  if (!token) return reply.status(400).send({ error: 'Token requerido' });
  try {
    const query = `INSERT INTO device_tokens (token) VALUES ($1) ON CONFLICT (token) DO NOTHING RETURNING *;`;
    await pool.query(query, [token]);
    return { success: true, message: 'Token registrado exitosamente' };
  } catch (error) {
    return reply.status(500).send({ error: 'Error al registrar token' });
  }
});

// --- SISTEMA DE NOTIFICACIONES ---
async function checkUpcomingEvents() {
  try {
    const ahora = new Date();
    const fechaActual = ahora.toISOString().split('T')[0];
    const horaActual = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const queryEventos = `
      SELECT id, plant_name, action, notes FROM plant_events 
      WHERE to_char(event_date, 'YYYY-MM-DD') = $1 AND event_time = $2;
    `;
    const resultEventos = await pool.query(queryEventos, [fechaActual, horaActual]);
    if (resultEventos.rows.length === 0) return;
    const resultTokens = await pool.query('SELECT token FROM device_tokens');
    const tokens = resultTokens.rows.map(row => row.token);
    if (tokens.length === 0) return;

    for (const evento of resultEventos.rows) {
      for (const token of tokens) {
        try {
          await axios.post('https://exp.host/--/api/v2/push/send', {
            to: token,
            sound: 'default',
            title: `¡Hora de cuidar tus plantas! 🌱`,
            body: `${evento.action} para tu ${evento.plant_name}.`,
            channelId: 'alertas-backend',
          });
        } catch (err) {
          fastify.log.error(`Error enviando push token`);
        }
      }
    }
  } catch (error) {
    fastify.log.error('Error en el cron de notificaciones');
  }
}
setInterval(checkUpcomingEvents, 60000);


// --- 🟢 SECCIÓN: RECETAS E HISTORIAL RELACIONAL ---

fastify.get('/plants-detailed', async (request, reply) => {
  try {
    const result = await pool.query(`
      SELECT id, COALESCE(common_name, plant_name) AS name 
      FROM identified_plants 
      ORDER BY id DESC;
    `);
    return result.rows;
  } catch (error) {
    return reply.status(500).send({ error: 'Error al cargar plantas' });
  }
});

// 🟢 NUEVO ENDPOINT: Obtener el historial completo de recetas con agregación de tags de plantas
fastify.get('/recipes', async (request, reply) => {
  try {
    const query = `
      SELECT r.id, r.title, r.instructions, r.created_at,
             json_agg(json_build_object('id', p.id, 'name', COALESCE(p.common_name, p.plant_name))) as used_plants
      FROM recipes r
      INNER JOIN recipe_plants rp ON r.id = rp.recipe_id
      INNER JOIN identified_plants p ON rp.plant_id = p.id
      GROUP BY r.id
      ORDER BY r.created_at DESC;
    `;
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Error al obtener el historial de recetas' });
  }
});

fastify.post('/generate-recipes', async (request, reply) => {
  const { plant_ids } = request.body;
  if (!plant_ids || plant_ids.length === 0) {
    return reply.status(400).send({ error: 'Selecciona al menos una planta.' });
  }

  try {
    const plantsQuery = await pool.query(
      'SELECT id, COALESCE(common_name, plant_name) as name FROM identified_plants WHERE id = ANY($1)',
      [plant_ids]
    );
    const listaPlantas = plantsQuery.rows.map(p => p.name).join(', ');

    const prompt = `
    Actúa como un chef profesional y botánico medicinal. Crea una receta saludable utilizando de forma segura los siguientes ingredientes botánicos: ${listaPlantas}.
    Responde UNICAMENTE un objeto JSON estructurado, sin textos extras fuera del JSON, respetando estas claves exactas:
    {
      "title": "Nombre creativo de la receta",
      "recipe": "Pasos detallados de preparación..."
    }
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const res = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }] });
    
    const rawText = res.data.candidates[0].content.parts[0].text;
    const cleaned = limpiarJson(rawText);
    const parsed = JSON.parse(cleaned);

    // Persistencia de la receta en DB
    const insertRecipe = await pool.query(
      'INSERT INTO recipes (title, instructions) VALUES ($1, $2) RETURNING id, title, instructions',
      [parsed.title, parsed.recipe]
    );
    const newRecipeId = insertRecipe.rows[0].id;

    // Vincular la receta con las plantas correspondientes
    for (const plantId of plant_ids) {
      await pool.query('INSERT INTO recipe_plants (recipe_id, plant_id) VALUES ($1, $2)', [newRecipeId, plantId]);
    }

    // Retornamos la estructura completa estructurada para actualizar el feed reactivamente
    return { 
      success: true, 
      recipe: {
        id: newRecipeId,
        title: insertRecipe.rows[0].title,
        instructions: insertRecipe.rows[0].instructions,
        used_plants: plantsQuery.rows
      }
    };
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Error al procesar la receta con Gemini' });
  }
});

fastify.delete('/plants/:id', async (request, reply) => {
  const { id } = request.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const findRecipes = await client.query('SELECT recipe_id FROM recipe_plants WHERE plant_id = $1', [id]);
    const recipeIds = findRecipes.rows.map(r => r.recipe_id);

    await client.query('DELETE FROM identified_plants WHERE id = $1', [id]);

    if (recipeIds.length > 0) {
      await client.query('DELETE FROM recipes WHERE id = ANY($1)', [recipeIds]);
    }
    await client.query('COMMIT');
    return { success: true, message: 'Planta y dependencias purgadas' };
  } catch (error) {
    await client.query('ROLLBACK');
    return reply.status(500).send({ error: 'Error en transaccional de borrado' });
  } finally {
    client.release();
  }
});

const start = async () => {
  try { await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' }); } catch (err) { process.exit(1); }
};
start();