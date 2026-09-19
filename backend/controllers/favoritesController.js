const axios = require('axios');
const { PYTHON_SERVICE_URL } = require('../config/constants');

/**
 * Controlador para estadisticas de reproduccion, canciones favoritas en repeticion e historial de YouTube.
 */

async function handleGetFavorites(req, res) {
  try {
    const limit = req.query.limit || 30;
    const scope = req.query.scope || 'general';
    const sessionId = req.query.session_id || null;
    const response = await axios.get(`${PYTHON_SERVICE_URL}/favorites/repeats`, {
      params: { limit, scope, session_id: sessionId },
      timeout: 5000
    });
    return res.json(response.data);
  } catch (error) {
    console.error("Error obteniendo favoritas:", error.message);
    return res.json({ favorites: [], scope: req.query.scope || 'general' });
  }
}

async function handleGetFavoriteCount(req, res) {
  try {
    const { videoId } = req.params;
    const sessionId = req.query.session_id || null;
    const response = await axios.get(`${PYTHON_SERVICE_URL}/favorites/count/${videoId}`, {
      params: { session_id: sessionId },
      timeout: 3000
    });
    return res.json(response.data);
  } catch (error) {
    return res.json({ totalCount: 0, requestCount: 0, likeCount: 0, sessionCount: 0 });
  }
}

async function handleRecordHistory(req, res) {
  try {
    const { videoId } = req.params;
    const response = await axios.post(`${PYTHON_SERVICE_URL}/history/record/${videoId}`, {}, { timeout: 4000 });
    return res.json(response.data);
  } catch (error) {
    return res.json({ status: "error", message: error.message });
  }
}

module.exports = {
  handleGetFavorites,
  handleGetFavoriteCount,
  handleRecordHistory
};
