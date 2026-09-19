import React, { useState, useEffect } from 'react';
import { X, Heart, Ban, Plus, Music, User, Disc, Check, AlertCircle, Sparkles } from 'lucide-react';

const QUICK_FAV_GENRES = [
  'R&B', 'Neo-Soul', 'Lo-Fi', 'Hip-Hop', 'Indie', 'Pop', 'Soul', 'Jazz', 'Funk', 'Rock Alternativo'
];

const QUICK_DIS_GENRES = [
  'Reggaetón', 'Trap', 'Metal Pesado', 'Corridos', 'Electrónica Pesada', 'Cumbia', 'Bachata'
];

export default function TasteProfileModal({
  isOpen,
  onClose,
  tasteProfile,
  onSaveTasteProfile,
  loading = false
}) {
  const [activeTab, setActiveTab] = useState('favorites'); // 'favorites' | 'dislikes'
  
  // Estados locales editables
  const [favoriteArtists, setFavoriteArtists] = useState([]);
  const [favoriteSongs, setFavoriteSongs] = useState([]);
  const [favoriteGenres, setFavoriteGenres] = useState([]);
  
  const [dislikedArtists, setDislikedArtists] = useState([]);
  const [dislikedSongs, setDislikedSongs] = useState([]);
  const [dislikedGenres, setDislikedGenres] = useState([]);

  // Inputs temporales
  const [artistInput, setArtistInput] = useState('');
  const [songTitleInput, setSongTitleInput] = useState('');
  const [songArtistInput, setSongArtistInput] = useState('');
  const [genreInput, setGenreInput] = useState('');

  const [disArtistInput, setDisArtistInput] = useState('');
  const [disSongTitleInput, setDisSongTitleInput] = useState('');
  const [disSongArtistInput, setDisSongArtistInput] = useState('');
  const [disGenreInput, setDisGenreInput] = useState('');

  const [statusMessage, setStatusMessage] = useState(null);

  // Sincronizar estado cuando se abre el modal o cambia el perfil externo
  useEffect(() => {
    if (tasteProfile) {
      setFavoriteArtists(tasteProfile.favorite_artists || []);
      setFavoriteSongs(tasteProfile.favorite_songs || []);
      setFavoriteGenres(tasteProfile.favorite_genres || []);
      setDislikedArtists(tasteProfile.disliked_artists || []);
      setDislikedSongs(tasteProfile.disliked_songs || []);
      setDislikedGenres(tasteProfile.disliked_genres || []);
    }
  }, [tasteProfile, isOpen]);

  if (!isOpen) return null;

  // --- Handlers de Favoritos ---
  const handleAddFavArtist = (e) => {
    if (e) e.preventDefault();
    const val = artistInput.trim();
    if (!val) return;
    if (!favoriteArtists.some(a => a.toLowerCase() === val.toLowerCase())) {
      setFavoriteArtists(prev => [...prev, val]);
    }
    setArtistInput('');
  };

  const handleRemoveFavArtist = (artistToRemove) => {
    setFavoriteArtists(prev => prev.filter(a => a !== artistToRemove));
  };

  const handleAddFavSong = (e) => {
    if (e) e.preventDefault();
    const title = songTitleInput.trim();
    const artist = songArtistInput.trim();
    if (!title) return;
    const newSong = artist ? { title, artist } : { title };
    const exists = favoriteSongs.some(s => {
      const sTitle = typeof s === 'object' ? s.title : s;
      return sTitle.toLowerCase() === title.toLowerCase();
    });
    if (!exists) {
      setFavoriteSongs(prev => [...prev, newSong]);
    }
    setSongTitleInput('');
    setSongArtistInput('');
  };

  const handleRemoveFavSong = (idx) => {
    setFavoriteSongs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleToggleFavGenre = (genre) => {
    if (favoriteGenres.some(g => g.toLowerCase() === genre.toLowerCase())) {
      setFavoriteGenres(prev => prev.filter(g => g.toLowerCase() !== genre.toLowerCase()));
    } else {
      setFavoriteGenres(prev => [...prev, genre]);
    }
  };

  const handleAddCustomFavGenre = (e) => {
    if (e) e.preventDefault();
    const val = genreInput.trim();
    if (!val) return;
    if (!favoriteGenres.some(g => g.toLowerCase() === val.toLowerCase())) {
      setFavoriteGenres(prev => [...prev, val]);
    }
    setGenreInput('');
  };

  // --- Handlers de Restricciones (No me gusta) ---
  const handleAddDisArtist = (e) => {
    if (e) e.preventDefault();
    const val = disArtistInput.trim();
    if (!val) return;
    if (!dislikedArtists.some(a => a.toLowerCase() === val.toLowerCase())) {
      setDislikedArtists(prev => [...prev, val]);
    }
    setDisArtistInput('');
  };

  const handleRemoveDisArtist = (artistToRemove) => {
    setDislikedArtists(prev => prev.filter(a => a !== artistToRemove));
  };

  const handleAddDisSong = (e) => {
    if (e) e.preventDefault();
    const title = disSongTitleInput.trim();
    const artist = disSongArtistInput.trim();
    if (!title) return;
    const newSong = artist ? { title, artist } : { title };
    const exists = dislikedSongs.some(s => {
      const sTitle = typeof s === 'object' ? s.title : s;
      return sTitle.toLowerCase() === title.toLowerCase();
    });
    if (!exists) {
      setDislikedSongs(prev => [...prev, newSong]);
    }
    setDisSongTitleInput('');
    setDisSongArtistInput('');
  };

  const handleRemoveDisSong = (idx) => {
    setDislikedSongs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleToggleDisGenre = (genre) => {
    if (dislikedGenres.some(g => g.toLowerCase() === genre.toLowerCase())) {
      setDislikedGenres(prev => prev.filter(g => g.toLowerCase() !== genre.toLowerCase()));
    } else {
      setDislikedGenres(prev => [...prev, genre]);
    }
  };

  const handleAddCustomDisGenre = (e) => {
    if (e) e.preventDefault();
    const val = disGenreInput.trim();
    if (!val) return;
    if (!dislikedGenres.some(g => g.toLowerCase() === val.toLowerCase())) {
      setDislikedGenres(prev => [...prev, val]);
    }
    setDisGenreInput('');
  };

  // --- Guardar Perfil ---
  const handleSave = async () => {
    setStatusMessage(null);
    const payload = {
      favorite_artists: favoriteArtists,
      favorite_songs: favoriteSongs,
      favorite_genres: favoriteGenres,
      disliked_artists: dislikedArtists,
      disliked_songs: dislikedSongs,
      disliked_genres: dislikedGenres
    };

    try {
      if (onSaveTasteProfile) {
        await onSaveTasteProfile(payload);
        setStatusMessage({ type: 'success', text: 'Gustos musicales guardados con éxito' });
        setTimeout(() => {
          setStatusMessage(null);
        }, 3000);
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Error al guardar las preferencias' });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content taste-profile-modal" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="taste-modal-title"
      >
        {/* Encabezado */}
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon-badge taste-badge">
              <Heart size={20} className="taste-icon-active" />
            </div>
            <div>
              <h3 id="taste-modal-title">Personalidad y Gustos Musicales</h3>
              <p className="modal-subtitle">Configura lo que te encanta y lo que prefieres no escuchar</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar" title="Cerrar">
            <X size={20} />
          </button>
        </div>

        {/* Pestañas de navegación */}
        <div className="taste-scope-tabs">
          <button 
            type="button"
            className={`taste-scope-tab ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            <Heart size={16} />
            <span className="tab-label">Lo que te gusta</span>
            <span className="tab-pill-badge">
              {favoriteArtists.length + favoriteSongs.length + favoriteGenres.length}
            </span>
          </button>
          
          <button 
            type="button"
            className={`taste-scope-tab dislike-tab ${activeTab === 'dislikes' ? 'active' : ''}`}
            onClick={() => setActiveTab('dislikes')}
          >
            <Ban size={16} />
            <span className="tab-label">Lo que NO te gusta</span>
            <span className="tab-pill-badge dislike-badge">
              {dislikedArtists.length + dislikedSongs.length + dislikedGenres.length}
            </span>
          </button>
        </div>

        <div className="modal-body taste-modal-body">
          {activeTab === 'favorites' ? (
            <div className="taste-tab-content">
              {/* Artistas Favoritos */}
              <div className="taste-section">
                <div className="taste-section-header">
                  <div className="taste-section-title">
                    <User size={17} />
                    <h4>Artistas Favoritos</h4>
                  </div>
                  <span className="taste-counter">{favoriteArtists.length} añadidos</span>
                </div>
                <p className="taste-help-text">
                  El DJ priorizará estos artistas y su estilo al recomendarte música y sorpresas.
                </p>

                <form className="taste-input-row" onSubmit={handleAddFavArtist}>
                  <input
                    type="text"
                    placeholder="Ej: Daniel Caesar, Frank Ocean, Mac Miller..."
                    value={artistInput}
                    onChange={(e) => setArtistInput(e.target.value)}
                    className="taste-text-input"
                  />
                  <button type="submit" className="taste-add-btn" disabled={!artistInput.trim()}>
                    <Plus size={16} />
                    <span>Agregar</span>
                  </button>
                </form>

                <div className="taste-chips-container">
                  {favoriteArtists.length === 0 ? (
                    <span className="taste-empty-text">No has agregado artistas favoritos aún.</span>
                  ) : (
                    favoriteArtists.map((artist) => (
                      <span key={artist} className="taste-chip fav-chip">
                        <span className="chip-label">{artist}</span>
                        <button 
                          type="button" 
                          className="chip-remove-btn" 
                          onClick={() => handleRemoveFavArtist(artist)}
                          title="Eliminar artista"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Canciones Favoritas */}
              <div className="taste-section">
                <div className="taste-section-header">
                  <div className="taste-section-title">
                    <Music size={17} />
                    <h4>Canciones Favoritas</h4>
                  </div>
                  <span className="taste-counter">{favoriteSongs.length} añadidas</span>
                </div>
                <p className="taste-help-text">
                  Tus temas predilectos para que el DJ los tenga siempre presentes en el radar.
                </p>

                <form className="taste-dual-input-row" onSubmit={handleAddFavSong}>
                  <input
                    type="text"
                    placeholder="Título de la canción (ej: Best Part)"
                    value={songTitleInput}
                    onChange={(e) => setSongTitleInput(e.target.value)}
                    className="taste-text-input"
                  />
                  <input
                    type="text"
                    placeholder="Artista (ej: Daniel Caesar)"
                    value={songArtistInput}
                    onChange={(e) => setSongArtistInput(e.target.value)}
                    className="taste-text-input"
                  />
                  <button type="submit" className="taste-add-btn" disabled={!songTitleInput.trim()}>
                    <Plus size={16} />
                    <span>Agregar</span>
                  </button>
                </form>

                <div className="taste-chips-container">
                  {favoriteSongs.length === 0 ? (
                    <span className="taste-empty-text">No has agregado canciones favoritas aún.</span>
                  ) : (
                    favoriteSongs.map((song, idx) => {
                      const title = typeof song === 'object' ? song.title : song;
                      const artist = typeof song === 'object' ? song.artist : '';
                      return (
                        <span key={`${title}-${idx}`} className="taste-chip fav-chip">
                          <span className="chip-label">
                            <strong>{title}</strong>
                            {artist && <span className="chip-sub"> • {artist}</span>}
                          </span>
                          <button 
                            type="button" 
                            className="chip-remove-btn" 
                            onClick={() => handleRemoveFavSong(idx)}
                            title="Eliminar canción"
                          >
                            <X size={13} />
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Géneros Favoritos */}
              <div className="taste-section">
                <div className="taste-section-header">
                  <div className="taste-section-title">
                    <Disc size={17} />
                    <h4>Géneros Favoritos</h4>
                  </div>
                  <span className="taste-counter">{favoriteGenres.length} seleccionados</span>
                </div>
                <p className="taste-help-text">
                  Selecciona de la lista rápida o agrega tus propios géneros.
                </p>

                <div className="taste-quick-pills">
                  {QUICK_FAV_GENRES.map(g => {
                    const isSelected = favoriteGenres.some(item => item.toLowerCase() === g.toLowerCase());
                    return (
                      <button
                        key={g}
                        type="button"
                        className={`taste-quick-pill ${isSelected ? 'active' : ''}`}
                        onClick={() => handleToggleFavGenre(g)}
                      >
                        {isSelected && <Check size={13} className="pill-check-icon" />}
                        <span>{g}</span>
                      </button>
                    );
                  })}
                </div>

                <form className="taste-input-row" onSubmit={handleAddCustomFavGenre} style={{ marginTop: '10px' }}>
                  <input
                    type="text"
                    placeholder="Otro género (ej: Indie Pop, Chillhop, Motown...)"
                    value={genreInput}
                    onChange={(e) => setGenreInput(e.target.value)}
                    className="taste-text-input"
                  />
                  <button type="submit" className="taste-add-btn" disabled={!genreInput.trim()}>
                    <Plus size={16} />
                    <span>Agregar</span>
                  </button>
                </form>

                {favoriteGenres.length > 0 && (
                  <div className="taste-chips-container" style={{ marginTop: '10px' }}>
                    {favoriteGenres.map(g => (
                      <span key={g} className="taste-chip fav-chip">
                        <span className="chip-label">{g}</span>
                        <button 
                          type="button" 
                          className="chip-remove-btn" 
                          onClick={() => handleToggleFavGenre(g)}
                          title="Eliminar género"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="taste-tab-content">
              {/* Artistas Vetados */}
              <div className="taste-section">
                <div className="taste-section-header">
                  <div className="taste-section-title dislike-title">
                    <User size={17} />
                    <h4>Artistas que no te gustan (Bloqueo Total)</h4>
                  </div>
                  <span className="taste-counter dislike-counter">{dislikedArtists.length} bloqueados</span>
                </div>
                <p className="taste-help-text">
                  No sonará ninguna canción de estos artistas en la radio ni en recomendaciones.
                </p>

                <form className="taste-input-row" onSubmit={handleAddDisArtist}>
                  <input
                    type="text"
                    placeholder="Nombre del artista a bloquear..."
                    value={disArtistInput}
                    onChange={(e) => setDisArtistInput(e.target.value)}
                    className="taste-text-input"
                  />
                  <button type="submit" className="taste-add-btn dislike-btn" disabled={!disArtistInput.trim()}>
                    <Plus size={16} />
                    <span>Bloquear</span>
                  </button>
                </form>

                <div className="taste-chips-container">
                  {dislikedArtists.length === 0 ? (
                    <span className="taste-empty-text">No tienes ningún artista bloqueado.</span>
                  ) : (
                    dislikedArtists.map((artist) => (
                      <span key={artist} className="taste-chip dis-chip">
                        <span className="chip-label">{artist}</span>
                        <button 
                          type="button" 
                          className="chip-remove-btn" 
                          onClick={() => handleRemoveDisArtist(artist)}
                          title="Desbloquear artista"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Canciones Vetadas Específicas */}
              <div className="taste-section">
                <div className="taste-section-header">
                  <div className="taste-section-title dislike-title">
                    <Music size={17} />
                    <h4>Canciones que no te gustan (Veto Individual)</h4>
                  </div>
                  <span className="taste-counter dislike-counter">{dislikedSongs.length} vetadas</span>
                </div>
                <p className="taste-help-text highlighted-help">
                  <strong>Importante:</strong> Solo se bloqueará esta canción específica. Si te gusta el artista, sus demás temas seguirán sonando con normalidad.
                </p>

                <form className="taste-dual-input-row" onSubmit={handleAddDisSong}>
                  <input
                    type="text"
                    placeholder="Título de la canción a vetar"
                    value={disSongTitleInput}
                    onChange={(e) => setDisSongTitleInput(e.target.value)}
                    className="taste-text-input"
                  />
                  <input
                    type="text"
                    placeholder="Artista (recomendado para precisión)"
                    value={disSongArtistInput}
                    onChange={(e) => setDisSongArtistInput(e.target.value)}
                    className="taste-text-input"
                  />
                  <button type="submit" className="taste-add-btn dislike-btn" disabled={!disSongTitleInput.trim()}>
                    <Plus size={16} />
                    <span>Vetar</span>
                  </button>
                </form>

                <div className="taste-chips-container">
                  {dislikedSongs.length === 0 ? (
                    <span className="taste-empty-text">No tienes canciones vetadas.</span>
                  ) : (
                    dislikedSongs.map((song, idx) => {
                      const title = typeof song === 'object' ? song.title : song;
                      const artist = typeof song === 'object' ? song.artist : '';
                      return (
                        <span key={`${title}-${idx}`} className="taste-chip dis-chip">
                          <span className="chip-label">
                            <strong>{title}</strong>
                            {artist && <span className="chip-sub"> • {artist}</span>}
                          </span>
                          <button 
                            type="button" 
                            className="chip-remove-btn" 
                            onClick={() => handleRemoveDisSong(idx)}
                            title="Quitar veto a esta canción"
                          >
                            <X size={13} />
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Géneros Vetados */}
              <div className="taste-section">
                <div className="taste-section-header">
                  <div className="taste-section-title dislike-title">
                    <Disc size={17} />
                    <h4>Géneros que no te gustan (Bloqueo de Estilo)</h4>
                  </div>
                  <span className="taste-counter dislike-counter">{dislikedGenres.length} bloqueados</span>
                </div>
                <p className="taste-help-text">
                  El DJ evitará seleccionar canciones de estos géneros en tus recomendaciones.
                </p>

                <div className="taste-quick-pills">
                  {QUICK_DIS_GENRES.map(g => {
                    const isSelected = dislikedGenres.some(item => item.toLowerCase() === g.toLowerCase());
                    return (
                      <button
                        key={g}
                        type="button"
                        className={`taste-quick-pill dislike-pill ${isSelected ? 'active' : ''}`}
                        onClick={() => handleToggleDisGenre(g)}
                      >
                        {isSelected && <Ban size={13} className="pill-check-icon" />}
                        <span>{g}</span>
                      </button>
                    );
                  })}
                </div>

                <form className="taste-input-row" onSubmit={handleAddCustomDisGenre} style={{ marginTop: '10px' }}>
                  <input
                    type="text"
                    placeholder="Otro género a evitar..."
                    value={disGenreInput}
                    onChange={(e) => setDisGenreInput(e.target.value)}
                    className="taste-text-input"
                  />
                  <button type="submit" className="taste-add-btn dislike-btn" disabled={!disGenreInput.trim()}>
                    <Plus size={16} />
                    <span>Bloquear</span>
                  </button>
                </form>

                {dislikedGenres.length > 0 && (
                  <div className="taste-chips-container" style={{ marginTop: '10px' }}>
                    {dislikedGenres.map(g => (
                      <span key={g} className="taste-chip dis-chip">
                        <span className="chip-label">{g}</span>
                        <button 
                          type="button" 
                          className="chip-remove-btn" 
                          onClick={() => handleToggleDisGenre(g)}
                          title="Desbloquear género"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pie del modal con botón de guardar */}
        <div className="taste-modal-footer">
          {statusMessage && (
            <div className={`taste-status-badge ${statusMessage.type}`}>
              {statusMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{statusMessage.text}</span>
            </div>
          )}
          <div className="taste-footer-actions">
            <button type="button" className="taste-cancel-btn" onClick={onClose}>
              Cerrar
            </button>
            <button 
              type="button" 
              className="taste-save-btn" 
              onClick={handleSave}
              disabled={loading}
            >
              <Sparkles size={16} />
              <span>{loading ? 'Guardando...' : 'Guardar Gustos Musicales'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
