const axios = require('axios');
const { PYTHON_SERVICE_URL } = require('../config/constants');
const { resetDJIntervention } = require('./chatState');

/**
 * Controlador para gestion y persistencia de sesiones de radio en PostgreSQL.
 */

async function handleGetCurrentSession(req, res) {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/session/current`, { timeout: 4000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Error obteniendo sesión actual:", error.message);
    return res.json({ exists: false, session: null, error: error.message });
  }
}

async function handleSaveSession(req, res) {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/session/save`, req.body, { timeout: 5000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Error guardando sesión:", error.message);
    return res.json({ success: false, error: error.message });
  }
}

async function handleResetSession(req, res) {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/session/reset`, req.body || {}, { timeout: 5000 });
    resetDJIntervention();
    return res.json(response.data);
  } catch (error) {
    console.error("Error reiniciando sesión:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function handleGetSessions(req, res) {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/sessions`, { timeout: 4000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Error listando sesiones:", error.message);
    return res.json({ sessions: [], error: error.message });
  }
}

async function handleLoadSession(req, res) {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/session/load`, req.body, { timeout: 5000 });
    resetDJIntervention();
    return res.json(response.data);
  } catch (error) {
    console.error("Error cargando sesión:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function handleCreateSession(req, res) {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/session/create`, req.body, { timeout: 5000 });
    resetDJIntervention();
    return res.json(response.data);
  } catch (error) {
    console.error("Error creando sesión:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function handleRenameSession(req, res) {
  try {
    const { id } = req.params;
    const response = await axios.put(`${PYTHON_SERVICE_URL}/session/${id}/rename`, req.body, { timeout: 4000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Error renombrando sesión:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function handleDeleteSession(req, res) {
  try {
    const { id } = req.params;
    const response = await axios.delete(`${PYTHON_SERVICE_URL}/session/${id}`, { timeout: 4000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Error eliminando sesión:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  handleGetCurrentSession,
  handleSaveSession,
  handleResetSession,
  handleGetSessions,
  handleLoadSession,
  handleCreateSession,
  handleRenameSession,
  handleDeleteSession
};
