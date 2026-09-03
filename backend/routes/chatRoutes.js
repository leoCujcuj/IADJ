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
  handleDeleteSession
} = require('../controllers/chatController');

router.post('/chat', handleChat);
router.post('/preload', handlePreload);
router.post('/session/transition', handleSessionTransition);

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
