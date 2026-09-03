import psycopg2
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

def get_db_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"⚠️ No se pudo conectar a PostgreSQL: {e}")
        return None

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
                print(f"✅ Base de datos '{DB_CONFIG['database']}' creada.")
            
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
            """)
            conn.commit()
            print("✅ Tablas 'user_tokens', 'radio_sessions' y 'session_interactions' listas.")
            cur.close()
            conn.close()
            break
        except Exception as e:
            retries -= 1
            if retries == 0:
                print(f"❌ Error fatal configurando la base de datos: {e}")
                break
            print(f"⏳ Esperando a la base de datos... Reintentos restantes: {retries}")
            time.sleep(2)

if __name__ == "__main__":
    init_db()
