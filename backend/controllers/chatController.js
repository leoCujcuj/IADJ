const axios = require('axios');
const { PYTHON_SERVICE_URL } = require('../config/constants');
const { getDJDecision } = require('../services/djService');
const { generateTTS } = require('../services/ttsService');

async function handleChat(req, res) {
  const { message, currentSong, searchType } = req.body;
  
  try {
    const statusRes = await axios.get(`${PYTHON_SERVICE_URL}/status`);
    const isLogged = statusRes.data.status !== "invitado";
    
    let musicHistory = [];
    if (isLogged) {
      try {
        const historyRes = await axios.get(`${PYTHON_SERVICE_URL}/history?limit=10`);
        musicHistory = historyRes.data || [];
      } catch (hErr) {
        console.error("Error cargando historial de música:", hErr.message);
      }
    }

    const historyContext = musicHistory.length > 0 
      ? musicHistory.map(h => `${h.title} - ${h.artists?.[0]?.name}`).join(', ')
      : "No hay historial";

    const prompt = `MODO: ${isLogged ? 'LOGUEADO' : 'INVITADO'}. \nUsuario dice: "${message}". \nTIPO SELECCIONADO: ${searchType || 'song'}. \nSonando ahora: ${currentSong?.title || 'Nada'}. \nHistorial reciente: ${historyContext}.`;

    let djDecision = await getDJDecision(prompt);
    
    // FORZAR COLA: Si el mensaje indica "siguiente", forzamos que la búsqueda sea "siguiente"
    // para que Python use current_queue.pop(0) en lugar de buscar algo nuevo.
    const isNextRequest = /siguiente|next|otra|cambia/i.test(message);
    if (isNextRequest && djDecision) {
      djDecision.busqueda = "siguiente";
    }
    
    if (!djDecision || !djDecision.busqueda) {
      djDecision = { locucion: "¡Aquí tienes!", busqueda: message };
    }

    console.log(`DJ (${searchType || 'song'}): "${djDecision.busqueda}"`);

    const audioUrl = await generateTTS(djDecision.locucion);

    try {
      const searchRes = await axios.get(`${PYTHON_SERVICE_URL}/search`, { 
        params: { q: djDecision.busqueda, type: searchType || 'song' } 
      });
      nextSong = searchRes.data;
    } catch (err) {
      console.error("Error en search_song:", err.message);
    }

    res.json({ 
      dj_comment: djDecision.locucion, 
      audioUrl, 
      nextSong 
    });

  } catch (error) {
    console.error("Error en controller chat:", error.message);
    res.status(500).json({ error: 'Server Error' });
  }
}

module.exports = {
  handleChat
};
