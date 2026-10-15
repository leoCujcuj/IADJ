const axios = require('axios');
const http = require('http');
const { PYTHON_SERVICE_URL } = require('../config/constants');

/**
 * Controlador de Cola y Estado del Reproductor (API Gateway para Python Music Service)
 * Utiliza keepAlive: false para prevenir errores de 'socket hang up' generados por cierre de sockets inactivos en Uvicorn.
 */
const pythonClient = axios.create({
  baseURL: PYTHON_SERVICE_URL,
  httpAgent: new http.Agent({ keepAlive: false })
});

async function handleGetStatus(req, res) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await pythonClient.get('/status', { timeout: 6000 });
      return res.json(response.data);
    } catch (error) {
      if (attempt === 1 && (error.code === 'ECONNRESET' || error.message.includes('socket hang up') || error.code === 'ETIMEDOUT')) {
        await new Promise(r => setTimeout(r, 100));
        continue;
      }
      console.error("Gateway /status error:", error.message);
      // No devolver queue: [] en caso de error para evitar que el frontend limpie la cola visible del usuario
      return res.status(503).json({
        status: "error",
        error: "Servicio de música temporalmente no disponible"
      });
    }
  }
}

async function handleQueuePop(req, res) {
  try {
    const response = await pythonClient.post('/queue/pop', {}, { timeout: 6000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Gateway /queue/pop error:", error.message);
    return res.status(500).json({ error: "Error extrayendo canción de la cola" });
  }
}

async function handleQueueRefill(req, res) {
  try {
    const response = await pythonClient.post('/queue/refill', {}, { timeout: 8000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Gateway /queue/refill error:", error.message);
    return res.status(500).json({ error: "Error rellenando la cola" });
  }
}

async function handleQueueStepBack(req, res) {
  try {
    const response = await pythonClient.post('/queue/step_back', req.body, { timeout: 5000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Gateway /queue/step_back error:", error.message);
    return res.status(500).json({ error: "Error en retroceso de cola" });
  }
}

async function handleQueueAdd(req, res) {
  try {
    const response = await pythonClient.post('/queue/add', null, {
      params: req.query,
      timeout: 7000
    });
    return res.json(response.data);
  } catch (error) {
    console.error("Gateway /queue/add error:", error.message);
    return res.status(500).json({ error: "Error añadiendo a la cola" });
  }
}

async function handleQueueMove(req, res) {
  try {
    const { videoId } = req.params;
    const response = await pythonClient.post(`/queue/move/${videoId}`, null, {
      params: req.query,
      timeout: 5000
    });
    return res.json(response.data);
  } catch (error) {
    console.error("Gateway /queue/move error:", error.message);
    return res.status(500).json({ error: "Error moviendo pista en la cola" });
  }
}

async function handleQueueRemove(req, res) {
  try {
    const { videoId } = req.params;
    const response = await pythonClient.post(`/queue/remove/${videoId}`, {}, { timeout: 5000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Gateway /queue/remove error:", error.message);
    return res.status(500).json({ error: "Error eliminando pista de la cola" });
  }
}

async function handleLike(req, res) {
  try {
    const { videoId } = req.params;
    const response = await pythonClient.post(`/like/${videoId}`, null, {
      params: req.query,
      timeout: 6000
    });
    return res.json(response.data);
  } catch (error) {
    console.error("Gateway /like error:", error.message);
    return res.status(500).json({ error: "Error registrando like" });
  }
}

async function handleDislike(req, res) {
  try {
    const videoId = req.params.videoId || '';
    const endpoint = videoId ? `/dislike/${videoId}` : `/dislike`;
    const response = await pythonClient.post(endpoint, null, {
      params: req.query,
      timeout: 6000
    });
    return res.json(response.data);
  } catch (error) {
    console.error("Gateway /dislike error:", error.message);
    return res.status(500).json({ error: "Error registrando dislike" });
  }
}

module.exports = {
  handleGetStatus,
  handleQueuePop,
  handleQueueRefill,
  handleQueueStepBack,
  handleQueueAdd,
  handleQueueMove,
  handleQueueRemove,
  handleDislike,
  handleLike
};
