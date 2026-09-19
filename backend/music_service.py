import os
import random
import json
import re
import time
import threading
from datetime import datetime
from fastapi import FastAPI, Query
from ytmusicapi import YTMusic, parsers
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from dotenv import load_dotenv
from init_db import get_db_connection, release_db_connection

load_dotenv()
app = FastAPI()

class TTLCache:
    def __init__(self, maxsize=150, ttl_seconds=1800):
        self.maxsize = maxsize
        self.ttl = ttl_seconds
        self.cache = {}
        self.lock = threading.Lock()

    def get(self, key):
        with self.lock:
            if key not in self.cache:
                return None
            val, timestamp = self.cache[key]
            if time.time() - timestamp > self.ttl:
                del self.cache[key]
                return None
            return val

    def set(self, key, value):
        with self.lock:
            if len(self.cache) >= self.maxsize:
                try:
                    oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k][1])
                    del self.cache[oldest_key]
                except Exception:
                    pass
            self.cache[key] = (value, time.time())

    def clear(self):
        with self.lock:
            self.cache.clear()

radio_cache = TTLCache(maxsize=120, ttl_seconds=1800)
artist_tracks_cache = TTLCache(maxsize=100, ttl_seconds=1800)
search_cache = TTLCache(maxsize=150, ttl_seconds=1200)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

yt_client = None
auth_status = "invitado"
current_queue = [] 
played_history = [] 
current_source = None
disliked_artists = set() 
disliked_songs = []
disliked_genres = set()
favorite_artists = set()
favorite_songs = []
favorite_genres = set()
currently_playing_id = None
currently_playing_title = ""
current_mode = "song"
current_mode_param = ""
is_refilling = False
refill_lock = threading.Lock()

def get_yt():
    global yt_client, auth_status
    if yt_client is not None: return yt_client
    headers_path = os.path.join(os.path.dirname(__file__), 'headers.json')
    if os.path.exists(headers_path):
        try:
            yt_client = YTMusic(headers_path)
            # Validación real: intentar obtener library para confirmar login
            yt_client.get_library_playlists(limit=1)
            auth_status = "logeado"
            print("DEBUG: Sesión de YouTube Music cargada correctamente.")
            return yt_client
        except Exception as e:
            print(f"DEBUG: Error al validar headers.json (posiblemente expirado): {str(e)}")
            yt_client = None
    
    print("DEBUG: Entrando como invitado (sesión no válida o inexistente).")
    yt_client = YTMusic()
    auth_status = "invitado"
    return yt_client

def extract_youtube_ids(text):
    """Extrae ID de video o de playlist de cualquier enlace de YouTube o YouTube Music"""
    v_id = None
    p_id = None
    if not text: return v_id, p_id
    
    # 1. Extraer ID de playlist si existe parámetro list=
    p_match = re.search(r"list=([0-9A-Za-z_-]+)", text)
    if p_match:
        p_id = p_match.group(1)
        
    # 2. Extraer ID de video si existe
    v_match = re.search(r"(?:v=|\/|be\/|shorts\/)([0-9A-Za-z_-]{11})", text)
    if v_match:
        v_id = v_match.group(1)
        
    return v_id, p_id

def fetch_playlist_tracks(yt, p_id, limit=50):
    """Obtiene canciones de una playlist estándar o de radio mix (RD / RDAMVM)"""
    tracks = []
    title = "Playlist"
    # Intentar obtener por endpoint directo de playlist
    try:
        data = yt.get_playlist(p_id, limit=limit)
        raw_tracks = data.get("tracks", [])
        title = data.get("title", "Playlist")
        for t in raw_tracks:
            vid = t.get("videoId")
            if vid:
                artist_name = t.get("artist") or (t.get("artists", [{}])[0].get("name") if t.get("artists") else "Unknown")
                tracks.append({"videoId": vid, "title": t.get("title", "Unknown"), "artist": artist_name})
        if tracks:
            return title, tracks
    except Exception as e:
        print(f"DEBUG: get_playlist directo falló para {p_id}: {e}")

    # Si falló (común en playlists generadas tipo RD o mezclas), usar watch next API
    try:
        res = yt._send_request('next', {'playlistId': p_id, 'isAudioOnly': True})
        tabs = res.get('contents', {}).get('singleColumnMusicWatchNextResultsRenderer', {}).get('tabbedRenderer', {}).get('watchNextTabbedResultsRenderer', {}).get('tabs', [])
        if tabs:
            mq = tabs[0].get('tabRenderer', {}).get('content', {}).get('musicQueueRenderer', {})
            ppr = mq.get('content', {}).get('playlistPanelRenderer', {})
            contents = ppr.get('contents', [])
            if contents:
                parsed = parsers.watch.parse_watch_playlist(contents)
                for t in parsed:
                    vid = t.get('videoId')
                    if vid:
                        artist_name = t.get('artist') or (t.get('artists', [{}])[0].get('name') if t.get('artists') else 'Unknown')
                        tracks.append({'videoId': vid, 'title': t.get('title', 'Unknown'), 'artist': artist_name})
                title = ppr.get('title', 'Mix Playlist')
    except Exception as e:
        print(f"DEBUG: Fallback watch next para playlist {p_id} falló: {e}")

    return title, tracks

def get_accurate_metadata(yt, video_id):
    try:
        song_data = yt.get_song(video_id)
        if 'videoDetails' in song_data:
            details = song_data['videoDetails']
            return {"videoId": video_id, "title": details.get('title'), "artist": details.get('author')}
    except: pass
    return {"videoId": video_id, "title": "YouTube Video", "artist": "Link"}

def get_song_radio(yt, video_id, limit=25):
    """Obtiene la radio automática oficial de YouTube Music para un video dado usando la playlist RDAMVM"""
    cached = radio_cache.get(video_id)
    if cached is not None:
        print(f"DEBUG: get_song_radio HIT CACHE para {video_id} ({len(cached)} canciones).")
        return cached[:limit]

    try:
        res = yt._send_request('next', {'playlistId': 'RDAMVM' + video_id, 'isAudioOnly': True})
        tabs = res.get('contents', {}).get('singleColumnMusicWatchNextResultsRenderer', {}).get('tabbedRenderer', {}).get('watchNextTabbedResultsRenderer', {}).get('tabs', [])
        if tabs:
            mq = tabs[0].get('tabRenderer', {}).get('content', {}).get('musicQueueRenderer', {})
            ppr = mq.get('content', {}).get('playlistPanelRenderer', {})
            contents = ppr.get('contents', [])
            if contents:
                tracks = parsers.watch.parse_watch_playlist(contents)
                clean_tracks = []
                for t in tracks:
                    v_id = t.get('videoId')
                    if v_id and v_id != video_id:
                        artist_name = t.get('artist') or (t.get('artists', [{}])[0].get('name') if t.get('artists') else 'Unknown')
                        clean_tracks.append({
                            'videoId': v_id,
                            'title': t.get('title', 'Unknown'),
                            'artist': artist_name,
                            'artists': t.get('artists', [])
                        })
                print(f"DEBUG: get_song_radio generó {len(clean_tracks)} canciones coherentes.")
                if clean_tracks:
                    radio_cache.set(video_id, clean_tracks)
                return clean_tracks[:limit]
    except Exception as e:
        print(f"DEBUG: Error en get_song_radio para {video_id}: {str(e)}")
    return []

def normalize_song_title(title: str, artist: str = "") -> str:
    if not title:
        return ""
    # Quitar paréntesis, corchetes y todo su contenido: (Official Video), [Audio], etc.
    t = re.sub(r'[\(\[].*?[\)\]]', '', title)
    # Quitar menciones de feat/ft fuera de paréntesis
    t = re.sub(r'\b(?:feat|ft)\.?\s+.*$', '', t, flags=re.IGNORECASE)
    # Si se conoce el artista, remover su nombre del título si está incluido
    if artist:
        t = re.sub(re.escape(artist), '', t, flags=re.IGNORECASE)
    # Limpiar guiones y espacios residuales
    t = re.sub(r'[^\w\s]', '', t)
    return re.sub(r'\s+', ' ', t).strip().lower()

def clean_display_title(title: str) -> str:
    if not title:
        return "Desconocido"
    clean = re.sub(r'[\(\[](?:official\s+(?:music\s+)?video|official\s+audio|video\s+oficial|audio\s+oficial|4k|hd|remastered(?:\s+\d+)?|lyric\s+video|visualizer|audio).*?[\)\]]', '', title, flags=re.IGNORECASE)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean or title

def is_track_disliked(title: str, artist: str = "") -> bool:
    if not title and not artist:
        return False
    t_clean = normalize_song_title(title, artist).lower() if title else ""
    a_clean = (artist or "").lower().strip()

    # 1. Chequeo por artista bloqueado
    for dis_a in disliked_artists:
        if not dis_a:
            continue
        dis_a_low = dis_a.lower().strip()
        if dis_a_low == a_clean or (len(dis_a_low) >= 3 and dis_a_low in a_clean) or (len(a_clean) >= 3 and a_clean in dis_a_low):
            return True

    # 2. Chequeo por cancion vetada
    for dis_s in disliked_songs:
        if isinstance(dis_s, dict):
            s_title = dis_s.get('title', '')
            s_artist = dis_s.get('artist', '')
            s_t_clean = normalize_song_title(s_title, s_artist).lower()
            s_a_clean = (s_artist or '').lower().strip()

            if s_a_clean:
                artist_match = (s_a_clean in a_clean or a_clean in s_a_clean)
                title_match = bool(s_t_clean and (s_t_clean == t_clean or (len(s_t_clean) >= 4 and s_t_clean in t_clean) or (len(t_clean) >= 4 and t_clean in s_t_clean)))
                if artist_match and title_match:
                    return True
            else:
                if s_t_clean and (s_t_clean == t_clean or (len(s_t_clean) >= 4 and s_t_clean in t_clean) or (len(t_clean) >= 4 and t_clean in s_t_clean)):
                    return True
        elif isinstance(dis_s, str):
            s_clean = normalize_song_title(dis_s).lower()
            if s_clean and (s_clean == t_clean or (len(s_clean) >= 4 and s_clean in t_clean) or (len(t_clean) >= 4 and t_clean in s_clean)):
                return True

    return False

def purge_disliked_from_queue():
    global current_queue
    before_len = len(current_queue)
    current_queue = [s for s in current_queue if not is_track_disliked(s.get('title', ''), s.get('artist', ''))]
    diff = before_len - len(current_queue)
    if diff > 0:
        print(f"DEBUG: Purgadas {diff} canciones de la cola por coincidir con la lista de no me gusta.")

def set_queue(tracks, source_name, clear=True, filter_history=True, append=False):
    global current_queue, current_source, currently_playing_id, currently_playing_title, played_history
    if clear: current_queue = []
    new_entries = []
    existing_ids = {s['videoId'] for s in current_queue if s.get('videoId')}
    if currently_playing_id: existing_ids.add(currently_playing_id)
    
    existing_titles = {normalize_song_title(s.get('title'), s.get('artist', '')) for s in current_queue if s.get('title')}
    if currently_playing_title:
        existing_titles.add(normalize_song_title(currently_playing_title))
    
    # Excluir canciones ya reproducidas en la sesión para evitar repeticiones
    history_ids = set()
    history_titles = set()
    if filter_history and played_history:
        history_ids = {p['videoId'] for p in played_history if p.get('videoId')}
        history_titles = {normalize_song_title(p.get('title'), p.get('artist', '')) for p in played_history if p.get('title')}
    
    for t in tracks:
        v_id = t.get('videoId')
        if not v_id:
            continue
        artist = t.get('artist') or (t['artists'][0]['name'] if t.get('artists') else "Unknown")
        title = t.get('title', 'Unknown')
        norm_t = normalize_song_title(title, artist)

        if v_id in existing_ids or (norm_t and norm_t in existing_titles):
            continue
        if v_id in history_ids or (norm_t and norm_t in history_titles):
            continue
        if is_track_disliked(title, artist):
            continue

        new_entries.append({"videoId": v_id, "title": clean_display_title(title), "artist": artist})
        existing_ids.add(v_id)
        if norm_t:
            existing_titles.add(norm_t)

    # Salvaguarda: si todas las sugerencias ya se escucharon (sesión muy larga),
    # permitir temas que no estén en las últimas 15 canciones escuchadas
    if not new_entries and tracks and (history_ids or history_titles):
        recent_ids = {p['videoId'] for p in played_history[:15] if p.get('videoId')}
        recent_titles = {normalize_song_title(p.get('title'), p.get('artist', '')) for p in played_history[:15] if p.get('title')}
        for t in tracks:
            v_id = t.get('videoId')
            if not v_id:
                continue
            artist = t.get('artist') or (t['artists'][0]['name'] if t.get('artists') else "Unknown")
            title = t.get('title', 'Unknown')
            norm_t = normalize_song_title(title, artist)

            if v_id in existing_ids or (norm_t and norm_t in existing_titles):
                continue
            if v_id in recent_ids or (norm_t and norm_t in recent_titles):
                continue
            if is_track_disliked(title, artist):
                continue

            new_entries.append({"videoId": v_id, "title": clean_display_title(title), "artist": artist})
            existing_ids.add(v_id)
            if norm_t:
                existing_titles.add(norm_t)
    
    if clear:
        current_queue = new_entries
        current_source = source_name
    elif append:
        current_queue = current_queue + new_entries
        if not current_source:
            current_source = source_name
    else:
        current_queue = new_entries + current_queue
        if not current_source:
            current_source = source_name
    current_queue = current_queue[:100]

def split_artist_names(query: str) -> List[str]:
    """Separa una cadena en una lista de artistas según comas, ' y ', ' and ', '&' o ' con '"""
    clean = re.sub(r'^(?:pon(?:me)?|reproduce|toca|quiero\s+escuchar|escuchar|busca|búscame)\s+(?:a\s+|de\s+)?', '', query, flags=re.IGNORECASE)
    clean = re.sub(r'^(?:a|de|el|la|los|las|solo)\s+', '', clean, flags=re.IGNORECASE)
    clean = re.sub(r'\b(?:album|álbum|cancion|canción|playlist|musica|música|discografia|discografía)\b', '', clean, flags=re.IGNORECASE).strip()
    parts = re.split(r'\s*(?:,|\by\b|\band\b|&|\bcon\b)\s*', clean, flags=re.IGNORECASE)
    return [p.strip() for p in parts if p.strip()]

def get_single_artist_tracks(yt, artist_query: str):
    """Obtiene canciones exclusivas de un solo artista"""
    norm_query = (artist_query or "").lower().strip()
    cached = artist_tracks_cache.get(norm_query)
    if cached is not None:
        print(f"DEBUG: get_single_artist_tracks HIT CACHE para {norm_query} ({len(cached[1])} temas).")
        return cached[0], list(cached[1])

    artist_res = yt.search(artist_query, filter="artists")
    if not artist_res:
        artist_res = yt.search(artist_query)
    if not artist_res:
        return artist_query, []

    artist_id = artist_res[0].get('browseId')
    artist_name = artist_res[0].get('artist') or artist_res[0].get('name') or artist_query

    tracks = []
    if artist_id:
        try:
            artist_data = yt.get_artist(artist_id)
            songs_sec = artist_data.get('songs', {})
            if isinstance(songs_sec, dict):
                pl_id = songs_sec.get('browseId')
                if pl_id:
                    pl = yt.get_playlist(pl_id, limit=50)
                    tracks = pl.get('tracks', [])
                elif 'results' in songs_sec:
                    tracks = songs_sec.get('results', [])
        except Exception as e:
            print(f"DEBUG: Error al obtener discografía de {artist_name}: {e}")

    clean_name_lower = artist_name.lower()
    if len(tracks) < 15:
        search_songs = yt.search(f"{artist_name}", filter="songs")
        for s in search_songs:
            s_artists = [a.get('name', '').lower() for a in s.get('artists', [])]
            if any(clean_name_lower in a or a in clean_name_lower for a in s_artists):
                if s.get('videoId') and s['videoId'] not in {t.get('videoId') for t in tracks}:
                    tracks.append(s)

    clean_tracks = []
    seen_track_titles = set()
    for t in tracks:
        v_id = t.get('videoId')
        if v_id:
            artist = t.get('artist') or (t['artists'][0]['name'] if t.get('artists') else artist_name)
            title = t.get('title', 'Unknown')
            norm_t = normalize_song_title(title, artist)
            if norm_t and norm_t in seen_track_titles:
                continue
            if norm_t:
                seen_track_titles.add(norm_t)
            clean_tracks.append({
                "videoId": v_id,
                "title": title,
                "artist": artist
            })

    if clean_tracks:
        artist_tracks_cache.set(norm_query, (artist_name, clean_tracks))
        artist_tracks_cache.set(artist_name.lower().strip(), (artist_name, clean_tracks))

    return artist_name, clean_tracks

def get_artist_discography_tracks(yt, artist_query):
    """Obtiene canciones exclusivas de uno o varios artistas entrelazándolas de forma equilibrada"""
    artists = split_artist_names(artist_query)
    if not artists:
        return None, []
    if len(artists) == 1:
        return get_single_artist_tracks(yt, artists[0])

    all_artist_names = []
    per_artist_tracks = []
    for art in artists:
        a_name, a_tracks = get_single_artist_tracks(yt, art)
        if a_tracks:
            all_artist_names.append(a_name)
            per_artist_tracks.append(a_tracks)

    if not per_artist_tracks:
        return None, []

    combined_name = ", ".join(all_artist_names)
    interleaved_tracks = []
    max_len = max(len(lst) for lst in per_artist_tracks)
    seen_ids = set()

    for i in range(max_len):
        for art_tracks in per_artist_tracks:
            if i < len(art_tracks):
                track = art_tracks[i]
                if track['videoId'] not in seen_ids:
                    seen_ids.add(track['videoId'])
                    interleaved_tracks.append(track)

    return combined_name, interleaved_tracks

def get_personal_mix(clear=True, append=False):
    global current_queue, current_source, currently_playing_id, played_history
    yt = get_yt()
    print(f"DEBUG: Intentando obtener Mix Personal. Status: {auth_status}")
    if auth_status == "logeado":
        try:
            # 1. Intentar obtener la playlist oficial de "Tus me gusta" (ID constante 'LM')
            print("DEBUG: Cargando playlist 'LM' (Liked Songs)...")
            liked_data = yt.get_playlist('LM', limit=100)
            tracks = liked_data.get("tracks", [])
            
            if not tracks:
                # 2. Si falla LM, intentar buscar "Mi Supermix"
                print("DEBUG: LM vacía, buscando 'Mi Supermix'...")
                search_results = yt.search("Mi Supermix", filter="playlists")
                if search_results:
                    liked_data = yt.get_playlist(search_results[0]['playlistId'], limit=50)
                    tracks = liked_data.get("tracks", [])

            if tracks:
                random.shuffle(tracks)
                set_queue(tracks, "Tus Favoritos Reales", clear=clear, append=append)
                print(f"DEBUG: Mix cargado con {len(tracks)} canciones.")
                return True
            else:
                print("DEBUG: No se encontraron canciones en los favoritos.")
        except Exception as e:
            print(f"DEBUG: Error en get_personal_mix: {str(e)}")
    return False

def _perform_refill(yt, threshold=10):
    global current_queue, currently_playing_id, currently_playing_title, played_history, current_mode, current_mode_param, is_refilling, current_source
    with refill_lock:
        if len(current_queue) > threshold:
            return
        is_refilling = True
        try:
            print(f"DEBUG: [AUTO-REFILL] Buscando más canciones. En cola: {len(current_queue)}, umbral: {threshold}")
            # 1. Modo Artista: mantener canciones exclusivas del artista
            if current_mode == "artist" and current_mode_param:
                _, more_tracks = get_artist_discography_tracks(yt, current_mode_param)
                if more_tracks:
                    set_queue(more_tracks, f"Solo {current_mode_param}", clear=False, filter_history=True, append=True)
                    if len(current_queue) > threshold:
                        print(f"DEBUG: [AUTO-REFILL] Modo Artista completado con {len(current_queue)} canciones.")
                        return

            # 2. Radio de YouTube Music basada en la última canción de la cola, o la actual, o el historial
            source_id = None
            if current_queue:
                source_id = current_queue[-1].get('videoId')
            if not source_id and currently_playing_id:
                source_id = currently_playing_id
            if not source_id and played_history:
                source_id = played_history[0].get('videoId')

            if source_id:
                radio = get_song_radio(yt, source_id, limit=25)
                if radio:
                    set_queue(radio, current_source or "Mix Automático", clear=False, filter_history=True, append=True)
                    if len(current_queue) > threshold:
                        print(f"DEBUG: [AUTO-REFILL] Radio ({source_id}) completada con {len(current_queue)} canciones.")
                        return

            # 3. Favoritos / Personal mix
            if auth_status == "logeado":
                if get_personal_mix(clear=False, append=True):
                    if len(current_queue) > threshold:
                        print(f"DEBUG: [AUTO-REFILL] Personal mix completado con {len(current_queue)} canciones.")
                        return

            # 4. Fallback por búsqueda contextual
            query = ""
            if current_queue:
                query = f"{current_queue[-1].get('artist', '')} {current_queue[-1].get('title', '')}".strip()
            if not query and played_history:
                query = f"{played_history[0].get('artist', '')} {played_history[0].get('title', '')}".strip()
            if not query:
                query = currently_playing_title or "Daniel Caesar Mac Miller Frank Ocean"

            fallback_tracks = yt.search(query, filter="songs")
            if fallback_tracks:
                clean_s = []
                for s in fallback_tracks:
                    v_id = s.get('videoId')
                    if v_id:
                        artist = s.get('artist') or (s['artists'][0]['name'] if s.get('artists') else "Unknown")
                        clean_s.append({"videoId": v_id, "title": s.get('title', 'Unknown'), "artist": artist})
                set_queue(clean_s, current_source or "Recomendaciones", clear=False, filter_history=True, append=True)
                print(f"DEBUG: [AUTO-REFILL] Búsqueda fallback completada con {len(current_queue)} canciones.")
        except Exception as e:
            print(f"DEBUG: Error en _perform_refill: {str(e)}")
        finally:
            is_refilling = False

def ensure_queue_populated(yt, threshold=10, blocking=False):
    global current_queue, is_refilling
    if len(current_queue) > threshold:
        return
    # Si la cola está completamente vacía (len == 0), debemos bloquear para que peek/pop obtenga un tema de inmediato
    if len(current_queue) == 0 or blocking:
        _perform_refill(yt, threshold)
    else:
        if is_refilling:
            return
        t = threading.Thread(target=_perform_refill, args=(yt, threshold))
        t.daemon = True
        t.start()

def purge_queue_duplicates():
    """Elimina del frente de la cola cualquier tema idéntico al que está sonando o al último del historial"""
    global current_queue, currently_playing_id, currently_playing_title, played_history
    curr_norm = normalize_song_title(currently_playing_title)
    last_hist_id = played_history[0].get('videoId') if played_history else None
    last_hist_norm = normalize_song_title(played_history[0].get('title'), played_history[0].get('artist', '')) if played_history else ""

    while current_queue:
        top = current_queue[0]
        top_id = top.get('videoId')
        top_norm = normalize_song_title(top.get('title'), top.get('artist', ''))
        is_repeat = False
        if currently_playing_id and top_id == currently_playing_id:
            is_repeat = True
        elif curr_norm and top_norm and curr_norm == top_norm:
            is_repeat = True
        elif last_hist_id and top_id == last_hist_id:
            is_repeat = True
        elif last_hist_norm and top_norm and last_hist_norm == top_norm:
            is_repeat = True

        if is_repeat:
            print(f"DEBUG: Purgando canción repetida del inicio de la cola: '{top.get('title')}' ({top_id})")
            current_queue.pop(0)
        else:
            break

@app.get("/queue/peek")
def peek_queue():
    global current_queue
    yt = get_yt()
    purge_queue_duplicates()
    ensure_queue_populated(yt, threshold=10, blocking=(len(current_queue) == 0))
    purge_queue_duplicates()
    if current_queue:
        return {"nextSong": current_queue[0], "queueLength": len(current_queue)}
    return {"nextSong": None, "queueLength": 0}

def record_youtube_playback(video_id: str):
    """Registra la reproducción en el historial oficial de la cuenta de YouTube del usuario"""
    global auth_status
    if not video_id:
        return
    def _worker():
        try:
            yt = get_yt()
            if auth_status == "logeado":
                song_data = yt.get_song(video_id)
                if song_data and 'playbackTracking' in song_data:
                    res = yt.add_history_item(song_data)
                    if res.status_code == 204:
                        print(f"DEBUG: [HISTORIAL YOUTUBE]: Canción {video_id} registrada con éxito en el historial oficial de YouTube.")
        except Exception as e:
            print(f"DEBUG: [HISTORIAL YOUTUBE]: Error registrando en historial de YouTube ({video_id}): {e}")

    t = threading.Thread(target=_worker)
    t.daemon = True
    t.start()

@app.post("/history/record/{video_id}")
def record_history_endpoint(video_id: str):
    record_youtube_playback(video_id)
    return {"status": "ok", "videoId": video_id}

@app.post("/queue/pop")
def pop_queue():
    global current_queue, played_history, currently_playing_id, currently_playing_title
    yt = get_yt()
    purge_queue_duplicates()
    ensure_queue_populated(yt, threshold=10, blocking=(len(current_queue) == 0))
    purge_queue_duplicates()
    if current_queue:
        song = current_queue.pop(0)
        currently_playing_id = song['videoId']
        currently_playing_title = song['title']
        played_history.insert(0, song)
        record_youtube_playback(song['videoId'])
        if len(current_queue) <= 10:
            ensure_queue_populated(yt, threshold=10, blocking=False)
        return song
    return {"error": "No hay canciones en la cola"}

@app.post("/queue/refill")
def refill_queue():
    global current_queue
    yt = get_yt()
    ensure_queue_populated(yt, threshold=10, blocking=True)
    purge_queue_duplicates()
    return {"status": "ok", "queueLength": len(current_queue)}

@app.get("/status")
def status():
    global current_mode, current_mode_param
    yt = get_yt()
    if len(current_queue) <= 10 and (currently_playing_id or played_history):
        ensure_queue_populated(yt, threshold=10, blocking=False)
    return {
        "status": auth_status,
        "queue": current_queue,
        "history": played_history,
        "source": current_source,
        "mode": current_mode,
        "modeParam": current_mode_param
    }

@app.get("/history")
def get_history_list(limit: int = 20):
    global played_history
    return played_history[:limit]

@app.post("/queue/add")
def add_to_queue(q: str = Query(...)):
    global current_queue
    try:
        yt = get_yt()
        v_id, p_id = extract_youtube_ids(q)
        
        if p_id:
            pl_title, tracks = fetch_playlist_tracks(yt, p_id, limit=50)
            if tracks:
                new_items = []
                for t in tracks:
                    if 'videoId' in t:
                        new_items.append({
                            "videoId": t['videoId'], 
                            "title": t.get('title', 'Unknown'), 
                            "artist": t.get('artist') or (t['artists'][0]['name'] if t.get('artists') else "YouTube")
                        })
                current_queue.extend(new_items)
                return {"status": "added_playlist", "title": pl_title, "count": len(new_items)}
        
        if v_id:
            item = get_accurate_metadata(yt, v_id)
            if len(current_queue) >= 10: current_queue.insert(9, item)
            else: current_queue.append(item)
            return {"status": "added", "song": item}

        # Si no es link, buscar por texto la canción y añadirla
        clean_text = q.strip()
        if clean_text:
            res = yt.search(clean_text, filter="songs")
            if res and res[0].get('videoId'):
                s = res[0]
                art = s.get('artist') or (s['artists'][0]['name'] if s.get('artists') else "Unknown")
                item = {"videoId": s['videoId'], "title": s.get('title', clean_text), "artist": art}
                current_queue.append(item)
                return {"status": "added", "song": item}
            
        return {"error": "No se pudo reconocer o encontrar la canción/link"}
    except Exception as e: return {"error": str(e)}

@app.get("/search")
def search_song(q: Optional[str] = Query(None), type: str = Query("song"), force: bool = Query(False)):
    global current_queue, current_source, played_history, currently_playing_id, currently_playing_title, disliked_artists, current_mode, current_mode_param
    try:
        yt = get_yt()
        q_raw = q or ""
        v_id, p_id = extract_youtube_ids(q_raw)

        # PRIORIDAD 0: COMANDO "SIGUIENTE" (Debe ser lo primero de todo)
        clean_q = q_raw.lower().replace("album", "").replace("cancion", "").replace("playlist", "").strip()
        if not clean_q or any(w in clean_q for w in ["siguiente", "next", "otra"]):
            # 1. Si ya hay canciones en la cola, tomar la siguiente
            if current_queue:
                purge_queue_duplicates()
                if current_queue:
                    song = current_queue.pop(0)
                    currently_playing_id = song['videoId']
                    currently_playing_title = song['title']
                    played_history.insert(0, song)
                    if len(current_queue) <= 10:
                        ensure_queue_populated(yt, threshold=10, blocking=False)
                    return song
            
            # 2. Si la cola está vacía pero estamos en MODO ARTISTA: recargar MÁS del mismo artista
            if current_mode == "artist" and current_mode_param:
                _, more_tracks = get_artist_discography_tracks(yt, current_mode_param)
                if more_tracks:
                    set_queue(more_tracks, f"Solo {current_mode_param}", clear=True, filter_history=True)
                    purge_queue_duplicates()
                    if current_queue:
                        song = current_queue.pop(0)
                        currently_playing_id = song['videoId']
                        currently_playing_title = song['title']
                        played_history.insert(0, song)
                        return song

            # 3. Si no es modo artista, radio de YouTube Music
            source_id = currently_playing_id or (played_history[0]['videoId'] if played_history else None)
            if source_id:
                radio_tracks = get_song_radio(yt, source_id, limit=25)
                if radio_tracks:
                    set_queue(radio_tracks, "Mix Automático")
                    purge_queue_duplicates()
                    if current_queue:
                        song = current_queue.pop(0)
                        currently_playing_id = song['videoId']
                        currently_playing_title = song['title']
                        played_history.insert(0, song)
                        return song
            
            # 4. Si la sesión es completamente NUEVA (recién entra el usuario y presiona siguiente):
            if get_personal_mix():
                purge_queue_duplicates()
                if current_queue:
                    song = current_queue.pop(0)
                    currently_playing_id = song['videoId']
                    currently_playing_title = song['title']
                    played_history.insert(0, song)
                    return song
            
            # 5. Fallback chill inicial
            initial_results = yt.search("Daniel Caesar Mac Miller Frank Ocean", filter="songs")
            if initial_results:
                first = initial_results[0]
                first_artist = first['artists'][0]['name'] if first.get('artists') else "Daniel Caesar"
                res_s = {"videoId": first['videoId'], "title": first['title'], "artist": first_artist}
                played_history.insert(0, res_s)
                currently_playing_id = res_s['videoId']
                set_queue(initial_results[1:], "Sesión Inicial")
                return res_s

            return {"error": "No se pudo iniciar la reproducción"}

        # PRIORIDAD 1: LINK DE PLAYLIST
        if p_id:
            pl_title, tracks = fetch_playlist_tracks(yt, p_id, limit=50)
            if tracks:
                current_mode = "playlist"
                current_mode_param = pl_title
                set_queue(tracks[1:], f"Playlist: {pl_title}", filter_history=False)
                res = {"videoId": tracks[0]['videoId'], "title": tracks[0]['title'], "artist": tracks[0].get('artist') or (tracks[0]['artists'][0]['name'] if tracks[0].get('artists') else "Unknown")}
                currently_playing_id = res['videoId']; played_history.insert(0, res); return res

        # PRIORIDAD 2: LINK DE VIDEO
        if v_id:
            res = get_accurate_metadata(yt, v_id)
            current_mode = "song"
            current_mode_param = ""
            currently_playing_id = v_id; currently_playing_title = res['title']
            played_history.insert(0, res); return res

        # Limpiamos el texto sin destruir palabras
        clean_q = q_raw.lower()
        for word in ["playlist", "album", "álbum", "canciones", "canción", "cancion"]:
            clean_q = clean_q.replace(word, "")
        clean_q = clean_q.strip()

        # NUEVA PRIORIDAD 2.5: BUSCAR EN TUS PROPIAS PLAYLISTS PRIMERO (solo si no es modo artista)
        if type != "artist" and auth_status == "logeado" and clean_q:
            lib = yt.get_library_playlists(limit=100)
            target_playlist = next((p for p in lib if clean_q in p['title'].lower()), None)
            
            if not target_playlist and "favorit" in clean_q:
                target_playlist = next((p for p in lib if "favorit" in p['title'].lower()), None)
            
            if target_playlist:
                data = yt.get_playlist(target_playlist['playlistId'], limit=50)
                tracks = data.get("tracks", [])
                if tracks:
                    current_mode = "playlist"
                    current_mode_param = data['title']
                    set_queue(tracks[1:], f"Tu Playlist: {data['title']}", filter_history=False)
                    res_s = {"videoId": tracks[0]['videoId'], "title": tracks[0]['title'], "artist": tracks[0]['artists'][0]['name'] if tracks[0].get('artists') else "Unknown"}
                    currently_playing_id = res_s['videoId']; played_history.insert(0, res_s); return res_s

        # PRIORIDAD 3: MODO PERSONAL GENÉRICO (si no es modo artista)
        if type != "artist" and any(w in clean_q for w in ["historial", "favorit", "mi musica", "mas escuchado", "mis me gusta", "liked"]):
            if get_personal_mix():
                if current_queue:
                    song = current_queue.pop(0)
                    played_history.insert(0, song); currently_playing_id = song['videoId']; return song
            else:
                return {"error": "No pude acceder a tus favoritos. ¿Estás logueado?"}

        # 4. MODO ARTISTA (Petición estricta de discografía de ese músico)
        if type == "artist":
            artist_name, artist_tracks = get_artist_discography_tracks(yt, clean_q or q_raw)
            if artist_tracks:
                current_mode = "artist"
                current_mode_param = artist_name
                first_song = artist_tracks[0]
                currently_playing_id = first_song['videoId']
                currently_playing_title = first_song['title']
                played_history.insert(0, first_song)
                # Poblar la cola con canciones de este artista únicamente
                set_queue(artist_tracks[1:], f"Solo {artist_name}", clear=True, filter_history=True)
                print(f"DEBUG: MODO ARTISTA activado para '{artist_name}'. {len(artist_tracks)} canciones en cola exclusiva.")
                return first_song

        # 5. MODO ALBUM (Cargar el álbum completo en orden)
        if type == "album":
            album_q = re.sub(r'^(?:pon(?:me)?|reproduce|toca|álbum|album|disco)\s+', '', clean_q or q_raw, flags=re.IGNORECASE).strip()
            res = yt.search(album_q or clean_q, filter="albums")
            if not res:
                res = yt.search(clean_q, filter="albums")
            if res:
                album_id = res[0].get('browseId')
                if album_id:
                    data = yt.get_album(album_id)
                    tracks = data.get("tracks", [])
                    if tracks:
                        current_mode = "album"
                        current_mode_param = data.get('title', 'Álbum')
                        first_track = tracks[0]
                        first_artist = data.get('artist') or (first_track['artists'][0]['name'] if first_track.get('artists') else 'Various')
                        res_s = {
                            "videoId": first_track['videoId'],
                            "title": first_track['title'],
                            "artist": first_artist
                        }
                        currently_playing_id = res_s['videoId']
                        currently_playing_title = res_s['title']
                        played_history.insert(0, res_s)
                        # Meter todas las canciones del álbum en orden
                        set_queue(tracks[1:], f"Álbum: {data['title']}", clear=True, filter_history=False)
                        print(f"DEBUG: MODO ÁLBUM activado para '{data['title']}'. {len(tracks)} canciones en orden.")
                        return res_s

        # 6. MODO PLAYLIST (Cargar playlist completa)
        if type == "playlist":
            playlist_q = re.sub(r'^(?:pon(?:me)?|reproduce|toca|playlist|lista)\s+', '', clean_q or q_raw, flags=re.IGNORECASE).strip()
            res = yt.search(playlist_q or clean_q, filter="playlists")
            if res:
                pl_id = res[0].get('playlistId') or res[0].get('browseId')
                if pl_id:
                    data = yt.get_playlist(pl_id, limit=50)
                    tracks = data.get("tracks", [])
                    if tracks:
                        current_mode = "playlist"
                        current_mode_param = data.get('title', 'Playlist')
                        first_track = tracks[0]
                        first_artist = first_track.get('artist') or (first_track['artists'][0]['name'] if first_track.get('artists') else 'Unknown')
                        res_s = {
                            "videoId": first_track['videoId'],
                            "title": first_track['title'],
                            "artist": first_artist
                        }
                        currently_playing_id = res_s['videoId']
                        currently_playing_title = res_s['title']
                        played_history.insert(0, res_s)
                        set_queue(tracks[1:], f"Playlist: {data['title']}", clear=True, filter_history=False)
                        print(f"DEBUG: MODO PLAYLIST activado para '{data['title']}'. {len(tracks)} canciones.")
                        return res_s

        # 7. MODO CANCIÓN / BÚSQUEDA GENERAL
        current_mode = "song"
        current_mode_param = ""
        results = yt.search(clean_q, filter="songs")
        if results:
            if force:
                song = results[0]
            else:
                song = next((r for r in results if not is_track_disliked(r.get('title', ''), r.get('artists', [{}])[0].get('name', '') if r.get('artists') else r.get('artist', ''))), results[0])
            currently_playing_id = song['videoId']
            try:
                radio_tracks = get_song_radio(yt, song['videoId'], limit=25)
                set_queue(radio_tracks, f"Mix: {song['title']}")
            except Exception as e:
                print(f"DEBUG: Error generando radio en search: {e}")
            played_history.insert(0, song)
            return {"videoId": song['videoId'], "title": song['title'], "artist": song['artists'][0]['name'] if song.get('artists') else "Unknown"}
            
        return {"error": "No results"}
    except Exception as e: return {"error": str(e)}

@app.get("/fallback-video")
def get_fallback_video(title: str = Query(...), artist: str = Query(""), exclude_id: str = Query("")):
    try:
        yt = get_yt()
        query = f"{artist} {title}".strip()
        excluded_ids = set([x.strip() for x in exclude_id.split(",") if x.strip()])
        # 1. Buscar en videos (los videos oficiales y lyric videos casi siempre permiten inserción en iframe)
        results = yt.search(query, filter="videos")
        for r in results:
            vid = r.get('videoId')
            if vid and vid not in excluded_ids:
                return {
                    "videoId": vid,
                    "title": r.get('title', title),
                    "artist": artist
                }
        # 2. Fallback general sin filtro
        results_all = yt.search(query)
        for r in results_all:
            vid = r.get('videoId')
            if vid and vid not in excluded_ids:
                return {
                    "videoId": vid,
                    "title": r.get('title', title),
                    "artist": artist
                }
        return {"error": "No alternative video found"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/queue/remove/{video_id}")
def remove_from_queue(video_id: str):
    global current_queue
    current_queue = [s for s in current_queue if s['videoId'] != video_id]
    if len(current_queue) <= 10:
        yt = get_yt()
        ensure_queue_populated(yt, threshold=10, blocking=False)
    return {"status": "removed"}

@app.post("/queue/move/{video_id}")
def move_in_queue(video_id: str, to_index: int = Query(...)):
    global current_queue
    song = next((s for s in current_queue if s['videoId'] == video_id), None)
    if song:
        current_queue = [s for s in current_queue if s['videoId'] != video_id]
        current_queue.insert(to_index, song)
        return {"status": "moved"}
    return {"error": "No encontrada"}

class BatchSongsPayload(BaseModel):
    songs: List[str]
    source_name: Optional[str] = "Lista de canciones"

@app.post("/queue/batch-songs")
def batch_songs_endpoint(payload: BatchSongsPayload):
    global current_queue, played_history, currently_playing_id, currently_playing_title, current_source, disliked_artists, current_mode, current_mode_param
    yt = get_yt()
    found_tracks = []
    
    for song_query in payload.songs:
        sq = (song_query or "").strip()
        if not sq:
            continue
        v_id, p_id = extract_youtube_ids(sq)
        if p_id:
            _, pl_tracks = fetch_playlist_tracks(yt, p_id, limit=50)
            found_tracks.extend(pl_tracks)
            continue
        if v_id:
            meta = get_accurate_metadata(yt, v_id)
            found_tracks.append(meta)
            continue

        try:
            results = yt.search(sq, filter="songs")
            if not results:
                results = yt.search(sq)
            if results:
                valid = results[0]
                if valid.get('videoId'):
                    artist_name = valid.get('artist') or (valid['artists'][0]['name'] if valid.get('artists') else "Unknown")
                    found_tracks.append({
                        "videoId": valid['videoId'],
                        "title": valid.get('title', sq),
                        "artist": artist_name
                    })
        except Exception as e:
            print(f"DEBUG: Error buscando canción del lote '{sq}': {e}")

    if not found_tracks:
        return {"error": "No se encontraron canciones"}

    first_song = found_tracks[0]
    currently_playing_id = first_song['videoId']
    currently_playing_title = first_song['title']
    played_history.insert(0, first_song)
    current_mode = "song"
    current_mode_param = ""
    
    remaining = found_tracks[1:]
    src_title = payload.source_name or "Lista seleccionada"
    # Las restantes canciones de la lista se insertan al inicio de la cola
    set_queue(remaining, src_title, clear=False, filter_history=False, append=False)
    
    return {
        "currentSong": first_song,
        "queuedCount": len(remaining),
        "queueLength": len(current_queue)
    }

class TrackRequestPayload(BaseModel):
    video_id: str
    title: str
    artist: str
    session_id: Optional[str] = None

def record_favorite_interaction(video_id: str, title: str, artist: str, interaction_type: str = "request", session_id: Optional[str] = None):
    if not video_id:
        return {"total_count": 0, "request_count": 0, "like_count": 0, "session_total_count": 0}
    title_clean = title or "Desconocido"
    artist_clean = artist or "Desconocido"
    conn = get_db_connection()
    if not conn:
        return {
            "total_count": 1,
            "request_count": 1 if interaction_type == "request" else 0,
            "like_count": 1 if interaction_type == "like" else 0,
            "session_total_count": 1 if session_id else 0
        }
    try:
        cur = conn.cursor()
        is_req = 1 if interaction_type == "request" else 0
        is_like = 1 if interaction_type == "like" else 0
        
        # 1. Registro global en song_favorites_repeats
        cur.execute("""
            INSERT INTO song_favorites_repeats (video_id, title, artist, request_count, like_count, total_count, last_played_at)
            VALUES (%s, %s, %s, %s, %s, 1, CURRENT_TIMESTAMP)
            ON CONFLICT (video_id) DO UPDATE SET
                title = EXCLUDED.title,
                artist = EXCLUDED.artist,
                request_count = song_favorites_repeats.request_count + EXCLUDED.request_count,
                like_count = song_favorites_repeats.like_count + EXCLUDED.like_count,
                total_count = song_favorites_repeats.total_count + 1,
                last_played_at = CURRENT_TIMESTAMP
            RETURNING total_count, request_count, like_count;
        """, (video_id, title_clean, artist_clean, is_req, is_like))
        row = cur.fetchone()
        global_total = row[0] if row else 1
        global_req = row[1] if row else is_req
        global_like = row[2] if row else is_like

        session_total = 0
        session_req = 0
        session_like = 0

        # 2. Si se proporciona session_id, registrar en session_song_repeats y session_interactions
        if session_id:
            cur.execute("""
                INSERT INTO session_song_repeats (session_id, video_id, title, artist, request_count, like_count, total_count, last_played_at)
                VALUES (%s, %s, %s, %s, %s, %s, 1, CURRENT_TIMESTAMP)
                ON CONFLICT (session_id, video_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    artist = EXCLUDED.artist,
                    request_count = session_song_repeats.request_count + EXCLUDED.request_count,
                    like_count = session_song_repeats.like_count + EXCLUDED.like_count,
                    total_count = session_song_repeats.total_count + 1,
                    last_played_at = CURRENT_TIMESTAMP
                RETURNING total_count, request_count, like_count;
            """, (session_id, video_id, title_clean, artist_clean, is_req, is_like))
            s_row = cur.fetchone()
            if s_row:
                session_total = s_row[0]
                session_req = s_row[1]
                session_like = s_row[2]

            cur.execute("""
                INSERT INTO session_interactions (session_id, video_id, title, artist, interaction_type)
                VALUES (%s, %s, %s, %s, %s);
            """, (session_id, video_id, title_clean, artist_clean, interaction_type))

        conn.commit()
        cur.close()
        release_db_connection(conn)
        return {
            "video_id": video_id,
            "title": title_clean,
            "artist": artist_clean,
            "total_count": global_total,
            "request_count": global_req,
            "like_count": global_like,
            "session_total_count": session_total,
            "session_request_count": session_req,
            "session_like_count": session_like
        }
    except Exception as e:
        print(f"Error registrando repetición favorita: {e}")
        if conn:
            release_db_connection(conn)
        return {
            "total_count": 1, 
            "request_count": 1 if interaction_type == "request" else 0, 
            "like_count": 1 if interaction_type == "like" else 0,
            "session_total_count": 0
        }

@app.post("/like/{video_id}")
def handle_like(video_id: str, artist: str, current_title: Optional[str] = Query(None), session_id: Optional[str] = Query(None)):
    global currently_playing_id, currently_playing_title
    currently_playing_id = video_id; currently_playing_title = current_title or ""
    
    # Registrar interacción de Like en el contador de favoritas (global y por estación)
    fav_data = record_favorite_interaction(video_id, current_title or currently_playing_title or "Canción", artist, "like", session_id=session_id)
    
    try:
        yt = get_yt()
        yt.rate_song(video_id, 'LIKE')
        
        radio_tracks = get_song_radio(yt, video_id, limit=20)
        set_queue(radio_tracks, f"Basado en {artist}", clear=False)
        return {
            "status": "liked", 
            "repeat_count": fav_data.get("session_total_count") or fav_data.get("total_count", 1),
            "global_repeat_count": fav_data.get("total_count", 1),
            "session_repeat_count": fav_data.get("session_total_count", 1)
        }
    except Exception as e:
        return {
            "status": "liked", 
            "repeat_count": fav_data.get("session_total_count") or fav_data.get("total_count", 1),
            "global_repeat_count": fav_data.get("total_count", 1),
            "session_repeat_count": fav_data.get("session_total_count", 1),
            "error": str(e)
        }

@app.post("/favorites/track-request")
def track_favorite_request(payload: TrackRequestPayload):
    data = record_favorite_interaction(payload.video_id, payload.title, payload.artist, "request", session_id=payload.session_id)
    return data

@app.get("/favorites/repeats")
def get_favorite_repeats(limit: int = 30, session_id: Optional[str] = Query(None), scope: str = Query("general")):
    conn = get_db_connection()
    if not conn:
        return {"favorites": []}
    try:
        cur = conn.cursor()
        if scope == "session" and session_id:
            # 1. Obtener de la tabla session_song_repeats
            cur.execute("""
                SELECT video_id, title, artist, request_count, like_count, total_count, last_played_at
                FROM session_song_repeats
                WHERE session_id = %s AND total_count >= 1
                ORDER BY total_count DESC, last_played_at DESC
                LIMIT %s;
            """, (session_id, limit))
            rows = cur.fetchall()

            favorites_dict = {}
            for r in rows:
                favorites_dict[r[0]] = {
                    "videoId": r[0],
                    "title": r[1],
                    "artist": r[2],
                    "requestCount": r[3],
                    "likeCount": r[4],
                    "totalCount": r[5],
                    "lastPlayedAt": r[6].isoformat() if r[6] else None
                }

            # 2. Agregar o consolidar con canciones que se hayan reproducido varias veces en el historial de la sesión
            try:
                cur.execute("SELECT history FROM radio_sessions WHERE id = %s;", (session_id,))
                h_row = cur.fetchone()
                if h_row and h_row[0]:
                    parsed_hist = parse_json_field(h_row[0], [])
                    hist_counts = {}
                    hist_info = {}
                    for item in parsed_hist:
                        v_id = item.get("videoId")
                        if v_id:
                            hist_counts[v_id] = hist_counts.get(v_id, 0) + 1
                            if v_id not in hist_info:
                                hist_info[v_id] = item
                    
                    for v_id, count in hist_counts.items():
                        if count >= 2:
                            if v_id in favorites_dict:
                                favorites_dict[v_id]["totalCount"] = max(favorites_dict[v_id]["totalCount"], count)
                            else:
                                item = hist_info[v_id]
                                favorites_dict[v_id] = {
                                    "videoId": v_id,
                                    "title": item.get("title", "Canción"),
                                    "artist": item.get("artist", "Desconocido"),
                                    "requestCount": 0,
                                    "likeCount": 0,
                                    "totalCount": count,
                                    "lastPlayedAt": None
                                }
            except Exception as h_err:
                print(f"Error analizando historial de sesión para repeticiones: {h_err}")

            favorites = list(favorites_dict.values())
            favorites.sort(key=lambda x: x["totalCount"], reverse=True)
            favorites = favorites[:limit]
        else:
            cur.execute("""
                SELECT video_id, title, artist, request_count, like_count, total_count, last_played_at
                FROM song_favorites_repeats
                WHERE total_count >= 1
                ORDER BY total_count DESC, last_played_at DESC
                LIMIT %s;
            """, (limit,))
            rows = cur.fetchall()
            favorites = [{
                "videoId": r[0],
                "title": r[1],
                "artist": r[2],
                "requestCount": r[3],
                "likeCount": r[4],
                "totalCount": r[5],
                "lastPlayedAt": r[6].isoformat() if r[6] else None
            } for r in rows]

        cur.close()
        release_db_connection(conn)
        return {"favorites": favorites, "scope": scope, "session_id": session_id}
    except Exception as e:
        print(f"Error obteniendo favoritos: {e}")
        if conn:
            release_db_connection(conn)
        return {"favorites": [], "scope": scope}

@app.get("/favorites/count/{video_id}")
def get_favorite_count(video_id: str, session_id: Optional[str] = Query(None)):
    conn = get_db_connection()
    if not conn:
        return {"totalCount": 0, "requestCount": 0, "likeCount": 0, "sessionCount": 0}
    try:
        cur = conn.cursor()
        cur.execute("SELECT total_count, request_count, like_count FROM song_favorites_repeats WHERE video_id = %s;", (video_id,))
        row = cur.fetchone()
        global_total = row[0] if row else 0
        global_req = row[1] if row else 0
        global_like = row[2] if row else 0

        session_total = 0
        session_req = 0
        session_like = 0
        if session_id:
            cur.execute("""
                SELECT total_count, request_count, like_count 
                FROM session_song_repeats 
                WHERE session_id = %s AND video_id = %s;
            """, (session_id, video_id))
            s_row = cur.fetchone()
            if s_row:
                session_total = s_row[0]
                session_req = s_row[1]
                session_like = s_row[2]
            
            # Revisar si se repitió en el historial de esta sesión
            try:
                cur.execute("SELECT history FROM radio_sessions WHERE id = %s;", (session_id,))
                h_row = cur.fetchone()
                if h_row and h_row[0]:
                    parsed_hist = parse_json_field(h_row[0], [])
                    h_count = sum(1 for item in parsed_hist if item.get("videoId") == video_id)
                    session_total = max(session_total, h_count)
            except Exception:
                pass

        cur.close()
        release_db_connection(conn)
        return {
            "totalCount": global_total,
            "requestCount": global_req,
            "likeCount": global_like,
            "sessionCount": session_total,
            "sessionRequestCount": session_req,
            "sessionLikeCount": session_like
        }
    except Exception as e:
        if conn:
            release_db_connection(conn)
        return {"totalCount": 0, "requestCount": 0, "likeCount": 0, "sessionCount": 0}

@app.get("/history")
def get_history_list(limit: int = 20):
    return played_history[:limit]

@app.post("/dislike/{video_id}")
def handle_dislike(video_id: str, artist: str):
    global current_queue, disliked_artists, current_source
    disliked_artists.add(artist)
    current_queue = [] 
    current_source = None
    
    try:
        yt = get_yt()
        yt.rate_song(video_id, 'DISLIKE')
    except: pass

    # Intentar rellenar la cola con favoritos/historial dinámico
    success = get_personal_mix()
    
    # Si no hay mix personal (invitado), preparamos radio coherente del historial anterior o fallback chill
    if not success:
        yt = get_yt()
        prior_artist = played_history[1]['artist'] if len(played_history) > 1 else "Mac Miller"
        fallback_results = yt.search(f"{prior_artist} chill soul", filter="songs")
        if fallback_results:
            set_queue(fallback_results, f"Mix Coherente {prior_artist}")
    
    return {"status": "disliked", "has_queue": len(current_queue) > 0}

def get_song_lyrics(yt, video_id: str):
    try:
        res = yt._send_request('next', {'videoId': video_id, 'isAudioOnly': True})
        tabs = res.get('contents', {}).get('singleColumnMusicWatchNextResultsRenderer', {}).get('tabbedRenderer', {}).get('watchNextTabbedResultsRenderer', {}).get('tabs', [])
        for t in tabs:
            tr = t.get('tabRenderer', {})
            endpoint = tr.get('endpoint', {}).get('browseEndpoint', {}).get('browseId')
            if endpoint and ('MPLY' in endpoint or 'lyrics' in str(tr.get('title', '')).lower()):
                lyrics_data = yt.get_lyrics(endpoint)
                if lyrics_data and lyrics_data.get('lyrics'):
                    return {
                        "lyrics": lyrics_data.get('lyrics'),
                        "source": lyrics_data.get('source', 'YouTube Music')
                    }
    except Exception as e:
        print(f"Error obteniendo letras para {video_id}: {e}")
    return {"lyrics": None, "source": None}

@app.get("/lyrics/{video_id}")
def get_lyrics(video_id: str):
    yt = get_yt()
    return get_song_lyrics(yt, video_id)

@app.post("/playlist/export")
def export_playlist(title: str = None):
    global played_history
    if not played_history:
        return {"error": "No hay canciones en la sesión de hoy para exportar"}

    # Recopilar IDs únicos de las canciones reproducidas hoy
    video_ids = []
    seen = set()
    for s in played_history:
        vid = s.get('videoId')
        if vid and vid not in seen:
            seen.add(vid)
            video_ids.append(vid)

    if not video_ids:
        return {"error": "No se encontraron canciones válidas"}

    now_str = datetime.now().strftime("%d/%m/%Y")
    playlist_title = title or f"Gemini Radio - Sesión {now_str}"
    description = f"Generada por Gemini AI DJ Radio con {len(video_ids)} canciones reproducidas en la sesión."

    # Si está logueado en YouTube Music, crear la playlist oficial en su cuenta
    yt = get_yt()
    if auth_status == "logeado":
        try:
            pl_id = yt.create_playlist(
                title=playlist_title,
                description=description,
                privacy_status="PRIVATE",
                video_ids=video_ids[:50]
            )
            return {
                "success": True,
                "type": "youtube_music",
                "playlistId": pl_id,
                "url": f"https://music.youtube.com/playlist?list={pl_id}",
                "count": len(video_ids)
            }
        except Exception as e:
            print(f"Error creando playlist oficial: {e}")

    # Modo Invitado o Fallback: Enlace directo que abre todas las canciones juntas en YouTube
    yt_watch_url = f"https://www.youtube.com/watch_videos?video_ids={','.join(video_ids[:50])}"
    return {
        "success": True,
        "type": "youtube_instant",
        "url": yt_watch_url,
        "count": len(video_ids),
        "video_ids": video_ids
    }

# ==========================================
# GESTIÓN Y PERSISTENCIA DE SESIONES EN BD
# ==========================================

def parse_json_field(val, default):
    if val is None:
        return default
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return default
    return default

class SessionSavePayload(BaseModel):
    id: Optional[str] = "session_default"
    name: Optional[str] = "Sesión Principal"
    current_song: Optional[Dict[str, Any]] = None
    queue: Optional[List[Dict[str, Any]]] = []
    history: Optional[List[Dict[str, Any]]] = []
    chat_history: Optional[List[Dict[str, Any]]] = []
    settings: Optional[Dict[str, Any]] = {}

class SessionLoadPayload(BaseModel):
    id: str

class SessionResetPayload(BaseModel):
    name: Optional[str] = "Nueva Sesión de Radio"

@app.get("/session/current")
def get_current_session():
    global current_queue, played_history, currently_playing_id, currently_playing_title
    conn = get_db_connection()
    if not conn:
        return {
            "exists": bool(currently_playing_id or current_queue or played_history),
            "source": "memory_fallback",
            "session": {
                "id": "session_memory",
                "name": "Sesión Local",
                "current_song": {
                    "videoId": currently_playing_id,
                    "title": currently_playing_title
                } if currently_playing_id else None,
                "queue": current_queue,
                "history": played_history,
                "chat_history": [],
                "settings": {}
            }
        }

    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, name, current_song, queue, history, chat_history, settings, is_active, updated_at
            FROM radio_sessions
            WHERE is_active = TRUE
            ORDER BY updated_at DESC
            LIMIT 1;
        """)
        row = cur.fetchone()
        cur.close()
        release_db_connection(conn)

        if not row:
            return {"exists": False, "session": None}

        sess_id, name, cur_song, q, h, chat_h, sett, is_act, updated_at = row
        parsed_cur_song = parse_json_field(cur_song, None)
        parsed_q = parse_json_field(q, [])
        parsed_h = parse_json_field(h, [])
        parsed_chat_h = parse_json_field(chat_h, [])
        parsed_sett = parse_json_field(sett, {})

        current_queue = parsed_q
        played_history = parsed_h
        if parsed_cur_song:
            currently_playing_id = parsed_cur_song.get("videoId")
            currently_playing_title = parsed_cur_song.get("title", "")

        return {
            "exists": True,
            "source": "database",
            "session": {
                "id": sess_id,
                "name": name,
                "current_song": parsed_cur_song,
                "queue": parsed_q,
                "history": parsed_h,
                "chat_history": parsed_chat_h,
                "settings": parsed_sett,
                "updated_at": str(updated_at)
            }
        }
    except Exception as e:
        print(f"Error recuperando sesión actual: {e}")
        return {"exists": False, "error": str(e), "session": None}

@app.post("/session/save")
def save_session(payload: SessionSavePayload):
    global current_queue, played_history, currently_playing_id, currently_playing_title
    
    if payload.queue is not None:
        current_queue = payload.queue
    if payload.history is not None:
        played_history = payload.history
    if payload.current_song:
        currently_playing_id = payload.current_song.get("videoId")
        currently_playing_title = payload.current_song.get("title", "")

    conn = get_db_connection()
    if not conn:
        return {"success": True, "saved_to": "memory_only", "warning": "PostgreSQL no disponible"}

    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO radio_sessions (id, name, current_song, queue, history, chat_history, settings, is_active, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE, NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = COALESCE(EXCLUDED.name, radio_sessions.name),
                current_song = EXCLUDED.current_song,
                queue = EXCLUDED.queue,
                history = EXCLUDED.history,
                chat_history = EXCLUDED.chat_history,
                settings = EXCLUDED.settings,
                is_active = TRUE,
                updated_at = NOW();
        """, (
            payload.id,
            payload.name,
            json.dumps(payload.current_song) if payload.current_song else None,
            json.dumps(payload.queue),
            json.dumps(payload.history),
            json.dumps(payload.chat_history),
            json.dumps(payload.settings)
        ))
        cur.execute("UPDATE radio_sessions SET is_active = FALSE WHERE id != %s;", (payload.id,))
        conn.commit()
        cur.close()
        release_db_connection(conn)
        return {"success": True, "saved_to": "database", "id": payload.id}
    except Exception as e:
        print(f"Error guardando sesión en BD: {e}")
        return {"success": False, "error": str(e)}

@app.post("/session/reset")
def reset_session(payload: Optional[SessionResetPayload] = None):
    global current_queue, played_history, currently_playing_id, currently_playing_title
    current_queue = []
    played_history = []
    currently_playing_id = None
    currently_playing_title = ""

    new_id = f"session_{int(datetime.now().timestamp())}"
    sess_name = payload.name if payload and payload.name else "Nueva Sesión de Radio"

    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("UPDATE radio_sessions SET is_active = FALSE;")
            cur.execute("""
                INSERT INTO radio_sessions (id, name, current_song, queue, history, chat_history, settings, is_active)
                VALUES (%s, %s, NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, TRUE);
            """, (new_id, sess_name))
            conn.commit()
            cur.close()
            release_db_connection(conn)
        except Exception as e:
            print(f"Error reseteando sesión en BD: {e}")

    return {
        "success": True,
        "new_session_id": new_id,
        "name": sess_name
    }

class SessionCreatePayload(BaseModel):
    name: str

class SessionRenamePayload(BaseModel):
    name: str

@app.post("/session/create")
def create_session(payload: SessionCreatePayload):
    global current_queue, played_history, currently_playing_id, currently_playing_title
    sess_name = (payload.name or "Nueva Sesión").strip()
    new_id = f"session_{int(datetime.now().timestamp())}_{random.randint(100, 999)}"
    initial_chat = [
        {
            "sender": "dj",
            "text": f"¡Qué onda! Esta es tu estación '{sess_name}'. ¿Qué rola ponemos para estrenarla?"
        }
    ]

    current_queue = []
    played_history = []
    currently_playing_id = None
    currently_playing_title = ""

    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("UPDATE radio_sessions SET is_active = FALSE;")
            cur.execute("""
                INSERT INTO radio_sessions (id, name, current_song, queue, history, chat_history, settings, is_active, created_at, updated_at)
                VALUES (%s, %s, NULL, '[]'::jsonb, '[]'::jsonb, %s, '{}'::jsonb, TRUE, NOW(), NOW());
            """, (new_id, sess_name, json.dumps(initial_chat)))
            conn.commit()
            cur.close()
            release_db_connection(conn)
        except Exception as e:
            print(f"Error creando nueva sesión en BD: {e}")

    return {
        "success": True,
        "session": {
            "id": new_id,
            "name": sess_name,
            "current_song": None,
            "queue": [],
            "history": [],
            "chat_history": initial_chat,
            "settings": {},
            "is_active": True
        }
    }

@app.put("/session/{session_id}/rename")
def rename_session(session_id: str, payload: SessionRenamePayload):
    new_name = (payload.name or "").strip()
    if not new_name:
        return {"error": "El nombre no puede estar vacío"}

    conn = get_db_connection()
    if not conn:
        return {"error": "Base de datos no disponible"}

    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE radio_sessions
            SET name = %s, updated_at = NOW()
            WHERE id = %s;
        """, (new_name, session_id))
        conn.commit()
        cur.close()
        release_db_connection(conn)
        return {"success": True, "id": session_id, "name": new_name}
    except Exception as e:
        print(f"Error renombrando sesión: {e}")
        return {"error": str(e)}

@app.delete("/session/{session_id}")
def delete_session(session_id: str):
    global current_queue, played_history, currently_playing_id, currently_playing_title
    conn = get_db_connection()
    if not conn:
        return {"error": "Base de datos no disponible"}

    try:
        cur = conn.cursor()
        # Verificar si era la sesión activa
        cur.execute("SELECT is_active FROM radio_sessions WHERE id = %s;", (session_id,))
        row = cur.fetchone()
        was_active = row[0] if row else False

        # Eliminar sesión
        cur.execute("DELETE FROM radio_sessions WHERE id = %s;", (session_id,))
        conn.commit()

        active_session = None
        if was_active:
            # Buscar la sesión más reciente restante
            cur.execute("""
                SELECT id, name, current_song, queue, history, chat_history, settings
                FROM radio_sessions
                ORDER BY updated_at DESC
                LIMIT 1;
            """)
            next_row = cur.fetchone()
            if next_row:
                n_id, n_name, n_song, n_q, n_h, n_chat, n_sett = next_row
                cur.execute("UPDATE radio_sessions SET is_active = TRUE, updated_at = NOW() WHERE id = %s;", (n_id,))
                conn.commit()
                parsed_cur_song = parse_json_field(n_song, None)
                parsed_q = parse_json_field(n_q, [])
                parsed_h = parse_json_field(n_h, [])
                parsed_chat = parse_json_field(n_chat, [])
                parsed_sett = parse_json_field(n_sett, {})

                current_queue = parsed_q
                played_history = parsed_h
                if parsed_cur_song:
                    currently_playing_id = parsed_cur_song.get("videoId")
                    currently_playing_title = parsed_cur_song.get("title", "")
                else:
                    currently_playing_id = None
                    currently_playing_title = ""

                active_session = {
                    "id": n_id,
                    "name": n_name,
                    "current_song": parsed_cur_song,
                    "queue": parsed_q,
                    "history": parsed_h,
                    "chat_history": parsed_chat,
                    "settings": parsed_sett
                }
            else:
                # Si no queda ninguna sesión, crear una por defecto
                fallback_id = f"session_{int(datetime.now().timestamp())}"
                fallback_name = "Sesión Principal"
                cur.execute("""
                    INSERT INTO radio_sessions (id, name, current_song, queue, history, chat_history, settings, is_active)
                    VALUES (%s, %s, NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, TRUE);
                """, (fallback_id, fallback_name))
                conn.commit()
                current_queue = []
                played_history = []
                currently_playing_id = None
                currently_playing_title = ""
                active_session = {
                    "id": fallback_id,
                    "name": fallback_name,
                    "current_song": None,
                    "queue": [],
                    "history": [],
                    "chat_history": [],
                    "settings": {}
                }

        cur.close()
        release_db_connection(conn)
        return {
            "success": True,
            "deleted_id": session_id,
            "was_active": was_active,
            "active_session": active_session
        }
    except Exception as e:
        print(f"Error eliminando sesión: {e}")
        return {"error": str(e)}

@app.get("/sessions")
def list_sessions():
    conn = get_db_connection()
    if not conn:
        return {"sessions": []}
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, name, is_active, created_at, updated_at, current_song,
                   COALESCE(jsonb_array_length(history), 0) as history_count,
                   COALESCE(jsonb_array_length(queue), 0) as queue_count,
                   COALESCE(jsonb_array_length(chat_history), 0) as msg_count
            FROM radio_sessions
            ORDER BY updated_at DESC
            LIMIT 30;
        """)
        rows = cur.fetchall()
        cur.close()
        release_db_connection(conn)

        sessions = []
        for r in rows:
            parsed_cur_song = parse_json_field(r[5], None)
            sessions.append({
                "id": r[0],
                "name": r[1],
                "is_active": r[2],
                "created_at": str(r[3]),
                "updated_at": str(r[4]),
                "current_song": parsed_cur_song,
                "history_count": r[6],
                "queue_count": r[7],
                "msg_count": r[8]
            })
        return {"sessions": sessions}
    except Exception as e:
        print(f"Error listando sesiones: {e}")
        return {"sessions": [], "error": str(e)}

@app.post("/session/load")
def load_session(payload: SessionLoadPayload):
    global current_queue, played_history, currently_playing_id, currently_playing_title
    conn = get_db_connection()
    if not conn:
        return {"error": "Base de datos no disponible"}
    try:
        cur = conn.cursor()
        cur.execute("UPDATE radio_sessions SET is_active = FALSE;")
        cur.execute("""
            UPDATE radio_sessions 
            SET is_active = TRUE, updated_at = NOW()
            WHERE id = %s
            RETURNING id, name, current_song, queue, history, chat_history, settings;
        """, (payload.id,))
        row = cur.fetchone()
        conn.commit()
        cur.close()
        release_db_connection(conn)

        if not row:
            return {"error": "Sesión no encontrada"}

        sess_id, name, cur_song, q, h, chat_h, sett = row
        parsed_cur_song = parse_json_field(cur_song, None)
        parsed_q = parse_json_field(q, [])
        parsed_h = parse_json_field(h, [])
        parsed_chat_h = parse_json_field(chat_h, [])
        parsed_sett = parse_json_field(sett, {})

        current_queue = parsed_q
        played_history = parsed_h
        if parsed_cur_song:
            currently_playing_id = parsed_cur_song.get("videoId")
            currently_playing_title = parsed_cur_song.get("title", "")
        else:
            currently_playing_id = None
            currently_playing_title = ""

        return {
            "success": True,
            "session": {
                "id": sess_id,
                "name": name,
                "current_song": parsed_cur_song,
                "queue": parsed_q,
                "history": parsed_h,
                "chat_history": parsed_chat_h,
                "settings": parsed_sett
            }
        }
    except Exception as e:
        print(f"Error cargando sesión {payload.id}: {e}")
        return {"error": str(e)}

# ==========================================
# PERFIL DE GUSTOS Y RESTRICCIONES MUSICALES
# ==========================================

class TasteProfilePayload(BaseModel):
    user_id: Optional[str] = "default_user"
    favorite_artists: Optional[List[str]] = []
    favorite_songs: Optional[List[Any]] = []
    favorite_genres: Optional[List[str]] = []
    disliked_artists: Optional[List[str]] = []
    disliked_songs: Optional[List[Any]] = []
    disliked_genres: Optional[List[str]] = []

def load_taste_profile_from_db():
    global favorite_artists, favorite_songs, favorite_genres, disliked_artists, disliked_songs, disliked_genres
    conn = get_db_connection()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT favorite_artists, favorite_songs, favorite_genres,
                   disliked_artists, disliked_songs, disliked_genres
            FROM user_music_profile
            WHERE id IN ('default_user', 'default_profile')
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 1;
        """)
        row = cur.fetchone()
        cur.close()
        release_db_connection(conn)

        if row:
            fav_a = parse_json_field(row[0], [])
            fav_s = parse_json_field(row[1], [])
            fav_g = parse_json_field(row[2], [])
            dis_a = parse_json_field(row[3], [])
            dis_s = parse_json_field(row[4], [])
            dis_g = parse_json_field(row[5], [])

            favorite_artists = set(fav_a) if isinstance(fav_a, list) else set()
            favorite_songs = fav_s if isinstance(fav_s, list) else []
            favorite_genres = set(fav_g) if isinstance(fav_g, list) else set()
            disliked_artists = set(dis_a) if isinstance(dis_a, list) else set()
            disliked_songs = dis_s if isinstance(dis_s, list) else []
            disliked_genres = set(dis_g) if isinstance(dis_g, list) else set()
            print(f"DEBUG: Perfil musical cargado desde DB. Favoritos: {len(favorite_artists)} art, {len(favorite_songs)} tracks. Bloqueados: {len(disliked_artists)} art, {len(disliked_songs)} tracks.")
    except Exception as e:
        print(f"DEBUG: Error cargando perfil musical de DB: {e}")

@app.on_event("startup")
def startup_event():
    load_taste_profile_from_db()

try:
    load_taste_profile_from_db()
except Exception as _e:
    pass

@app.get("/profile/taste")
def get_taste_profile():
    global favorite_artists, favorite_songs, favorite_genres, disliked_artists, disliked_songs, disliked_genres
    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT favorite_artists, favorite_songs, favorite_genres,
                       disliked_artists, disliked_songs, disliked_genres, updated_at
                FROM user_music_profile
                WHERE id IN ('default_user', 'default_profile')
                ORDER BY updated_at DESC NULLS LAST
                LIMIT 1;
            """)
            row = cur.fetchone()
            cur.close()
            release_db_connection(conn)
            if row:
                return {
                    "favorite_artists": parse_json_field(row[0], []),
                    "favorite_songs": parse_json_field(row[1], []),
                    "favorite_genres": parse_json_field(row[2], []),
                    "disliked_artists": parse_json_field(row[3], []),
                    "disliked_songs": parse_json_field(row[4], []),
                    "disliked_genres": parse_json_field(row[5], []),
                    "updated_at": str(row[6]) if row[6] else None
                }
        except Exception as e:
            print(f"DEBUG: Error consultando user_music_profile: {e}")
    
    return {
        "favorite_artists": sorted(list(favorite_artists)),
        "favorite_songs": favorite_songs,
        "favorite_genres": sorted(list(favorite_genres)),
        "disliked_artists": sorted(list(disliked_artists)),
        "disliked_songs": disliked_songs,
        "disliked_genres": sorted(list(disliked_genres)),
        "updated_at": None
    }

@app.post("/profile/taste")
def save_taste_profile(payload: TasteProfilePayload):
    global favorite_artists, favorite_songs, favorite_genres, disliked_artists, disliked_songs, disliked_genres
    
    fav_a = list(dict.fromkeys([x.strip() for x in (payload.favorite_artists or []) if x and x.strip()]))
    fav_s = payload.favorite_songs or []
    fav_g = list(dict.fromkeys([x.strip() for x in (payload.favorite_genres or []) if x and x.strip()]))
    dis_a = list(dict.fromkeys([x.strip() for x in (payload.disliked_artists or []) if x and x.strip()]))
    dis_s = payload.disliked_songs or []
    dis_g = list(dict.fromkeys([x.strip() for x in (payload.disliked_genres or []) if x and x.strip()]))

    favorite_artists = set(fav_a)
    favorite_songs = fav_s
    favorite_genres = set(fav_g)
    disliked_artists = set(dis_a)
    disliked_songs = dis_s
    disliked_genres = set(dis_g)

    purge_disliked_from_queue()

    conn = get_db_connection()
    if not conn:
        return {"error": "Base de datos no disponible"}
    try:
        cur = conn.cursor()
        target_id = payload.user_id or 'default_user'
        cur.execute("""
            INSERT INTO user_music_profile (
                id, favorite_artists, favorite_songs, favorite_genres,
                disliked_artists, disliked_songs, disliked_genres, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO UPDATE SET
                favorite_artists = EXCLUDED.favorite_artists,
                favorite_songs = EXCLUDED.favorite_songs,
                favorite_genres = EXCLUDED.favorite_genres,
                disliked_artists = EXCLUDED.disliked_artists,
                disliked_songs = EXCLUDED.disliked_songs,
                disliked_genres = EXCLUDED.disliked_genres,
                updated_at = NOW();
        """, (
            target_id,
            json.dumps(fav_a),
            json.dumps(fav_s),
            json.dumps(fav_g),
            json.dumps(dis_a),
            json.dumps(dis_s),
            json.dumps(dis_g)
        ))
        conn.commit()
        cur.close()
        release_db_connection(conn)
        return {
            "status": "success",
            "message": "Perfil musical guardado correctamente",
            "profile": {
                "favorite_artists": fav_a,
                "favorite_songs": fav_s,
                "favorite_genres": fav_g,
                "disliked_artists": dis_a,
                "disliked_songs": dis_s,
                "disliked_genres": dis_g
            }
        }
    except Exception as e:
        print(f"DEBUG: Error guardando user_music_profile: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
