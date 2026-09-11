const express = require('express');
const router = express.Router();
const { 
  handleChat, 
  handlePreload, 
  handleLyrics, 
  handleTranslateLyrics, 
  handleExportPlaylist, 
  handleTrivia, 
  handleSessionTransition,
  handleGetCurrentSession,
  handleSaveSession,
  handleResetSession,
  handleGetSessions,
  handleLoadSession,
  handleCreateSession,
  handleRenameSession,
  handleDeleteSession,
  handleFallbackVideo,
  handleGetFavorites,
  handleGetFavoriteCount,
  handleRecordHistory
} = require('../controllers/chatController');

router.post('/chat', handleChat);
router.post('/preload', handlePreload);
router.post('/session/transition', handleSessionTransition);

// Ruta para registrar reproducción en el historial oficial de YouTube
router.post('/history/record/:videoId', handleRecordHistory);

// Ruta para fallback de videos con restricción de iframe en YouTube
router.get('/video/fallback', handleFallbackVideo);

// Rutas para canciones favoritas en repetición
router.get('/favorites/repeats', handleGetFavorites);
router.get('/favorites/count/:videoId', handleGetFavoriteCount);

// Rutas de persistencia de sesiones
router.get('/session/current', handleGetCurrentSession);
router.post('/session/save', handleSaveSession);
router.post('/session/reset', handleResetSession);
router.get('/sessions', handleGetSessions);
router.post('/session/load', handleLoadSession);
router.post('/session/create', handleCreateSession);
router.put('/session/:id/rename', handleRenameSession);
router.delete('/session/:id', handleDeleteSession);

router.get('/lyrics/:videoId', handleLyrics);
router.post('/lyrics/:videoId/translate', handleTranslateLyrics);
router.get('/trivia/:videoId', handleTrivia);
router.post('/playlist/export', handleExportPlaylist);

module.exports = router;
