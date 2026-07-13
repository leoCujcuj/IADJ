require('dotenv').config();
const express = require('express');
const cors = require('cors');
const expressStatic = require('express').static;
const { PORT } = require('./config/constants');
const { audioFolder } = require('./services/ttsService');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Servir la carpeta de audios temporales
app.use('/audio', expressStatic(audioFolder));

// Rutas de la API
app.use('/api', chatRoutes);

app.listen(PORT, () => console.log(`🚀 Orquestador modular en puerto ${PORT}`));
