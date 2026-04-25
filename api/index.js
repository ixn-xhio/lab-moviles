import Fastify from 'fastify';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from '@fastify/cors'; // 1. Importar el plugin

dotenv.config();
const fastify = Fastify({ logger: true });

// 2. Registrar CORS antes de las rutas
// El "*" permite que cualquier cliente (App Móvil o Web) se conecte
await fastify.register(cors, { 
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE']
});

fastify.post('/identify-plant', async (request, reply) => {
  const { image } = request.body;

  if (!image) {
    return reply.status(400).send({ error: 'La imagen es requerida' });
  }

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
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Error al identificar la planta' });
  }
});

const start = async () => {
  try {
    // Escuchar en 0.0.0.0 es vital para Docker y Civo
    await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();