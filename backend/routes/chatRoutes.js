const express = require('express');
const router = express.Router();
const { handleChat, handlePreload, handleLyrics, handleTranslateLyrics, handleExportPlaylist, handleTrivia, handleSessionTransition } = require('../controllers/chatController');

router.post('/chat', handleChat);
router.post('/preload', handlePreload);
router.post('/session/transition', handleSessionTransition);
router.get('/lyrics/:videoId', handleLyrics);
router.post('/lyrics/:videoId/translate', handleTranslateLyrics);
router.get('/trivia/:videoId', handleTrivia);
router.post('/playlist/export', handleExportPlaylist);

module.exports = router;
