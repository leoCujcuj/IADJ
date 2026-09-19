import psycopg2
from psycopg2 import pool
import os
import time
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "database": os.getenv("DB_NAME", "youtube_music_dj"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASS", "postgres"),
    "port": os.getenv("DB_PORT", "5432")
}

db_pool = None

def get_db_pool():
    global db_pool
    if db_pool is None or db_pool.closed:
        try:
            db_pool = pool.ThreadedConnectionPool(
                minconn=2,
                maxconn=10,
                **DB_CONFIG
            )
        except Exception as e:
            print(f"No se pudo inicializar ThreadedConnectionPool: {e}")
            db_pool = None
    return db_pool

def get_db_connection():
    p = get_db_pool()
    if p:
        try:
            return p.getconn()
        except Exception as e:
            print(f"Error obteniendo conexion del pool: {e}")
    try:
        return psycopg2.connect(**DB_CONFIG)
    except Exception as e:
        print(f"No se pudo conectar a PostgreSQL: {e}")
        return None

def release_db_connection(conn):
    if conn is None:
        return
    p = get_db_pool()
    if p and not p.closed:
        try:
            p.putconn(conn)
            return
        except Exception:
            pass
    try:
        conn.close()
    except Exception:
        pass

def init_db():
    retries = 10
    while retries > 0:
        try:
            # Primero intentamos conectar a postgres para crear la base de datos si no existe
            conn = psycopg2.connect(
                host=DB_CONFIG["host"],
                user=DB_CONFIG["user"],
                password=DB_CONFIG["password"],
                port=DB_CONFIG["port"],
                database="postgres"
            )
            conn.autocommit = True
            cur = conn.cursor()
            
            # Verificar si la base de datos existe
            cur.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{DB_CONFIG['database']}';")
            exists = cur.fetchone()
            if not exists:
                cur.execute(f"CREATE DATABASE {DB_CONFIG['database']};")
                print(f"Base de datos '{DB_CONFIG['database']}' creada.")
            
            cur.close()
            conn.close()

            # Ahora conectamos a la base de datos específica para crear las tablas
            conn = psycopg2.connect(**DB_CONFIG)
            cur = conn.cursor()
            
            cur.execute("""
                CREATE TABLE IF NOT EXISTS user_tokens (
                    email TEXT PRIMARY KEY,
                    access_token TEXT,
                    refresh_token TEXT,
                    expires_at TIMESTAMP,
                    auth_data JSONB
                );

                CREATE TABLE IF NOT EXISTS radio_sessions (
                    id VARCHAR(64) PRIMARY KEY,
                    name TEXT NOT NULL DEFAULT 'Sesión Principal',
                    current_song JSONB,
                    queue JSONB DEFAULT '[]'::jsonb,
                    history JSONB DEFAULT '[]'::jsonb,
                    chat_history JSONB DEFAULT '[]'::jsonb,
                    settings JSONB DEFAULT '{}'::jsonb,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS session_interactions (
                    id SERIAL PRIMARY KEY,
                    session_id VARCHAR(64),
                    video_id TEXT,
                    title TEXT,
                    artist TEXT,
                    interaction_type VARCHAR(20),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS song_favorites_repeats (
                    video_id VARCHAR(64) PRIMARY KEY,
                    title TEXT NOT NULL,
                    artist TEXT NOT NULL,
                    request_count INT DEFAULT 0,
                    like_count INT DEFAULT 0,
                    total_count INT DEFAULT 0,
                    last_played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS session_song_repeats (
                    session_id VARCHAR(64) NOT NULL,
                    video_id VARCHAR(64) NOT NULL,
                    title TEXT NOT NULL,
                    artist TEXT NOT NULL,
                    request_count INT DEFAULT 0,
                    like_count INT DEFAULT 0,
                    total_count INT DEFAULT 0,
                    last_played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (session_id, video_id)
                );

                CREATE TABLE IF NOT EXISTS user_music_profile (
                    id VARCHAR(64) PRIMARY KEY DEFAULT 'default_profile',
                    favorite_artists JSONB DEFAULT '[]'::jsonb,
                    favorite_songs JSONB DEFAULT '[]'::jsonb,
                    favorite_genres JSONB DEFAULT '[]'::jsonb,
                    disliked_artists JSONB DEFAULT '[]'::jsonb,
                    disliked_songs JSONB DEFAULT '[]'::jsonb,
                    disliked_genres JSONB DEFAULT '[]'::jsonb,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.commit()
            print("Tablas 'user_tokens', 'radio_sessions', 'session_interactions', 'song_favorites_repeats', 'session_song_repeats' y 'user_music_profile' listas.")
            cur.close()
            conn.close()
            break
        except Exception as e:
            retries -= 1
            if retries == 0:
                print(f"Error fatal configurando la base de datos: {e}")
                break
            print(f"Esperando a la base de datos... Reintentos restantes: {retries}")
            time.sleep(2)

if __name__ == "__main__":
    init_db()
