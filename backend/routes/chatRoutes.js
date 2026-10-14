const express = require('express');
const router = express.Router();

const { 
  handleChat, 
  handlePreload, 
  handleSessionTransition,
  handleVoicePreview
} = require('../controllers/chatController');

const {
  handleGetCurrentSession,
  handleSaveSession,
  handleResetSession,
  handleGetSessions,
  handleLoadSession,
  handleCreateSession,
  handleRenameSession,
  handleDeleteSession
} = require('../controllers/sessionController');

const {
  handleGetTasteProfile,
  handleSaveTasteProfile
} = require('../controllers/profileController');

const {
  handleGetFavorites,
  handleGetFavoriteCount,
  handleRecordHistory
} = require('../controllers/favoritesController');

const {
  handleLyrics,
  handleTranslateLyrics,
  handleTrivia,
  handleExportPlaylist,
  handleFallbackVideo
} = require('../controllers/mediaController');

const {
  handleGetStatus,
  handleQueuePop,
  handleQueueRefill,
  handleQueueStepBack,
  handleQueueAdd,
  handleQueueMove,
  handleQueueRemove,
  handleDislike,
  handleLike
} = require('../controllers/queueController');

router.post('/chat', handleChat);
router.post('/preload', handlePreload);
router.post('/session/transition', handleSessionTransition);

// Rutas de API Gateway para Estado y Cola (unificadas en puerto 3001)
router.get('/status', handleGetStatus);
router.post('/queue/pop', handleQueuePop);
router.post('/queue/refill', handleQueueRefill);
router.post('/queue/step_back', handleQueueStepBack);
router.post('/queue/add', handleQueueAdd);
router.post('/queue/move/:videoId', handleQueueMove);
router.post('/queue/remove/:videoId', handleQueueRemove);
router.post('/like/:videoId', handleLike);
router.post('/dislike/:videoId', handleDislike);
router.post('/dislike', handleDislike);

// Ruta para preview de voz del locutor
router.post('/voice/preview', handleVoicePreview);

// Rutas de perfil musical (gustos y restricciones)
router.get('/profile/taste', handleGetTasteProfile);
router.post('/profile/taste', handleSaveTasteProfile);

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
