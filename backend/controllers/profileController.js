const axios = require('axios');
const { PYTHON_SERVICE_URL } = require('../config/constants');

/**
 * Controlador para gestion del perfil de gustos y restricciones musicales del usuario.
 */

async function handleGetTasteProfile(req, res) {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/profile/taste`);
    return res.json(response.data);
  } catch (error) {
    console.error("Error al obtener perfil musical:", error.message);
    return res.status(500).json({ error: "Error al obtener perfil musical" });
  }
}

async function handleSaveTasteProfile(req, res) {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/profile/taste`, req.body);
    return res.json(response.data);
  } catch (error) {
    console.error("Error al guardar perfil musical:", error.message);
    return res.status(500).json({ error: "Error al guardar perfil musical" });
  }
}

module.exports = {
  handleGetTasteProfile,
  handleSaveTasteProfile
};
