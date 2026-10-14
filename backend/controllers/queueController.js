const axios = require('axios');
const { PYTHON_SERVICE_URL } = require('../config/constants');

/**
 * Controlador de Cola y Estado del Reproductor (API Gateway para Python Music Service)
 */

async function handleGetStatus(req, res) {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/status`, { timeout: 4000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Gateway /status error:", error.message);
    return res.status(502).json({
      status: "error",
      queue: [],
      history: [],
      error: "Servicio de música no disponible"
    });
  }
}

async function handleQueuePop(req, res) {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/queue/pop`, {}, { timeout: 5000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Gateway /queue/pop error:", error.message);
    return res.status(500).json({ error: "Error extrayendo canción de la cola" });
  }
}

async function handleQueueRefill(req, res) {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/queue/refill`, {}, { timeout: 6000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Gateway /queue/refill error:", error.message);
    return res.status(500).json({ error: "Error rellenando la cola" });
  }
}

async function handleQueueStepBack(req, res) {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/queue/step_back`, req.body, { timeout: 4000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Gateway /queue/step_back error:", error.message);
    return res.status(500).json({ error: "Error en retroceso de cola" });
  }
}

async function handleQueueAdd(req, res) {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/queue/add`, null, {
      params: req.query,
      timeout: 6000
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
    const response = await axios.post(`${PYTHON_SERVICE_URL}/queue/move/${videoId}`, null, {
      params: req.query,
      timeout: 4000
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
    const response = await axios.post(`${PYTHON_SERVICE_URL}/queue/remove/${videoId}`, {}, { timeout: 4000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Gateway /queue/remove error:", error.message);
    return res.status(500).json({ error: "Error eliminando pista de la cola" });
  }
}

async function handleLike(req, res) {
  try {
    const { videoId } = req.params;
    const response = await axios.post(`${PYTHON_SERVICE_URL}/like/${videoId}`, null, {
      params: req.query,
      timeout: 5000
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
    const endpoint = videoId ? `${PYTHON_SERVICE_URL}/dislike/${videoId}` : `${PYTHON_SERVICE_URL}/dislike`;
    const response = await axios.post(endpoint, null, {
      params: req.query,
      timeout: 5000
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
