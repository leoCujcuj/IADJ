# Gemini Radio - AI YouTube Music DJ

Estacion de radio interactiva y orquestador musical impulsado por Inteligencia Artificial y sintesis de voz neuronal. Combina la transmision continua de YouTube Music con un locutor de radio que presenta temas, ofrece anecdotas, responde en tiempo real a peticiones por texto o voz y adapta sus recomendaciones al perfil de gustos y restricciones del usuario.

---

## Caracteristicas Principales

### 1. Locucion de Radio con Inteligencia Artificial
- **Personalidad Adaptable**: Modo Chill (relajado y suave), Energico (dinamico y festivo) o Melomano/Curador (enfocado en produccion y anecdotas).
- **Control de Frecuencia**: Define cada cuantas canciones interviene el locutor (cada 3, 5, 10 temas o exclusivamente al interactuar por chat).
- **Audio Ducking Dinamico**: Atenuacion suave y automatica del volumen de la musica mientras el locutor habla, con porcentaje configurable (0% a 60%) y restauracion suave.
- **Contexto Temporal Real**: El locutor reconoce la hora local exacta y el periodo del dia (manana, mediodia, tarde, noche) para modular sus saludos y transiciones.

### 2. Selector de Voces de Locucion
- **Catalogo de 8 Voces Neuronales (ElevenLabs)**:
  - *Masculinas*: Charlie (energico y seguro), Will (chill y relajado), Roger (grave y elegante), Eric (clasico y suave), Brian (profundo y sobrio).
  - *Femeninas*: Jessica (calida y alegre), Sarah (profesional y clara), Laura (entusiasta y vivaz).
- **Vista Previa de Audio**: Reproductor individual en la seccion de Ajustes para probar cada voz en tiempo real con formula de presentacion generalizada.
- **Cache Local de Audio (Cero Gasto Redundante)**: Las muestras y comentarios generados se almacenan en disco mediante clave hash MD5 (`voiceId + texto`), evitando consumir caracteres en llamadas repetidas.

### 3. Perfil de Gustos y Restricciones Musicales
- **Direccionamiento de Recomendaciones**:
  - Artistas Favoritos: Define artistas prioritarios para sugerencias y sesiones automaticas.
  - Canciones Favoritas: Catalogo de temas predilectos en el radar del locutor.
  - Generos Favoritos: Filtro rapido para mantener la radio en estilos afines.
- **Lista Negra y Vetos Estrictos**:
  - Artistas Prohibidos: Purga automatica de la cola y exclusion total en recomendaciones.
  - Canciones Vetadas: Exclusion de temas individuales manteniendo permitido al resto de la discografia del artista.
  - Generos Prohibidos: Prevencion de desvios no deseados.
  - *Excepcion de Orden Directa*: Si el usuario pide explicitamente una cancion vetada, el DJ la complace mencionando la excepcion con naturalidad.

### 4. Letras Sincronizadas (Modo Karaoke) y Traduccion
- **Sincronizacion en Tiempo Real**: Visualizacion verso a verso con avance temporal y scroll automatico mediante LRCLIB.
- **Traduccion Simultanea al Espanol**: Alineacion verso a verso con cache local persistente para no re-traducir pistas escuchadas previamente.
- **Fallback Automatico**: Si la cancion no dispone de timestamps, recurre a las letras estructuradas de YouTube Music.

### 5. Persistencia Completa de Sesiones (PostgreSQL)
- **Sincronizacion Continua**: Guarda automaticamente la cancion actual, la cola de reproduccion, el historial y los mensajes del chat en base de datos.
- **Multi-Sesion**: Permite crear nuevas sesiones, renombrarlas, cambiar entre ellas y archivarlas sin perder datos al cerrar o recargar el navegador.
- **Favoritas en Repeticion**: Panel con metricas de canciones mas escuchadas y solicitadas tanto a nivel de sesion como historico global.

### 6. Curiosidades y Trivia Musical
- **Generacion en Segundo Plano**: Analisis de produccion, colaboraciones y datos historicos de la pista en reproduccion.
- **Interaccion en Chat**: Boton para compartir anecdotas directamente a la conversacion con el DJ o solicitar informacion adicional.

---

## Arquitectura del Sistema

El sistema esta modularizado en cuatro servicios independientes orquestados mediante Docker Compose:

1. **Frontend (`frontend`)**:
   - Stack: React 18, Vite, Lucide Icons, CSS Modular con soporte de temas oscuros.
   - Funcionalidades: Reproductor con API YouTube Iframe, panel de chat interactivo, modales de ajustes, letras sincronizadas, sesiones y perfil musical.
   - Puerto: `5174`

2. **Orquestador Node.js (`node-backend`)**:
   - Stack: Node.js, Express, Axios.
   - Funcionalidades: Orquestacion de prompts, motor de decisiones del DJ, traduccion de letras, generacion TTS con ElevenLabs y almacenamiento de cache de audio.
   - Puerto: `3001`

3. **Servicio de Musica Python (`python-service`)**:
   - Stack: Python 3.11, FastAPI, ytmusicapi, Uvicorn.
   - Funcionalidades: Busqueda y encolado en YouTube Music, generacion de mezclas RDAMVM, extraccion de discografias, manejo de historial y persistencia en base de datos.
   - Puerto: `8000`

4. **Base de Datos PostgreSQL (`db`)**:
   - Stack: PostgreSQL 15 Alpine.
   - Tablas: `radio_sessions`, `session_interactions`, `song_favorites_repeats`, `session_song_repeats`, `user_music_profile`, `user_tokens`.
   - Puerto: `5433` (externo) / `5432` (interno de Docker)

---

## Optimizaciones de Rendimiento

- **Pool de Conexiones Thread-Safe**: Implementacion de `ThreadedConnectionPool` en PostgreSQL para eliminar la latencia de handshake TCP en cada consulta (reduccion de ~70 ms a <3 ms).
- **Cache LRU en Memoria con TTL**: Cache en memoria con expiracion a 30 minutos para radios de canciones y discografias de artistas en el servicio Python, reduciendo los tiempos de respuesta de 2100 ms a 76 ms (96% de aceleracion).
- **Carrera Concurrente en IA del DJ**: Timeout adaptativo de 2500 ms con fallback paralelo (`Promise.any`) en modelos de OpenRouter para asegurar respuestas en chat inferiores a 1.5 segundos.
- **Prevencion de Re-renders en React**: Comparacion superficial de listas (`isSameTrackList`) en el ciclo de sincronizacion de estado para evitar re-renderizaciones masivas de la interfaz cada 5 segundos.
- **Saneamiento Automatico de Metadatos**: Depuracion automatica de sufijos como `[Official Video]`, `(Remastered)`, etc., previo al ingreso a la cola.

---

## Requisitos Previos

- **Docker** y **Docker Compose**
- **Git**
- Llaves de API:
  - **OpenRouter** (para modelos LLM del DJ)
  - **ElevenLabs** (para sintesis de voz)

---

## Configuracion Inicial

1. **Crear archivo de variables de entorno**:
   Copia el archivo base y configuralo en `backend/.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. **Variables requeridas en `backend/.env`**:
   ```env
   OPENROUTER_API_KEY=tu_clave_de_openrouter
   ELEVENLABS_API_KEY=tu_clave_principal_de_elevenlabs
   ELEVENLABS_API_KEY_2=tu_clave_de_respaldo_opcional
   ELEVENLABS_VOICE_ID=IKne3meq5aSn9XLyUdCD

   PORT=3001
   PYTHON_SERVICE_URL=http://youtube-python-service:8000

   DB_USER=postgres
   DB_PASS=admin
   DB_NAME=youtube_music_dj
   DB_HOST=youtube-db
   DB_PORT=5432
   ```

3. **Sesion de YouTube Music (Opcional para cuenta personal)**:
   - Para vincular me gustas a tu cuenta e historial personal, coloca tu `headers.json` en `backend/headers.json`.
   - Si no se proporciona, el sistema opera automaticamente en **Modo Invitado**.

---

## Puesta en Marcha con Docker

Ejecuta en el directorio raiz del proyecto:

```bash
docker compose up --build
```

### URLs de Acceso
- **Interfaz Web (Frontend)**: [http://localhost:5174](http://localhost:5174)
- **API Orquestador (Node.js)**: [http://localhost:3001](http://localhost:3001)
- **Documentacion Swagger (FastAPI Python)**: [http://localhost:8000/docs](http://localhost:8000/docs)

### Detener los Servicios
```bash
# Apagar contenedores conservando la base de datos
docker compose down

# Apagar y reiniciar volumenes de base de datos desde cero
docker compose down -v
```

---

## Atajos de Teclado y Controles Multimedia

- `MediaTrackNext` o `Ctrl + Flecha Derecha`: Siguiente cancion de la cola.
- `MediaTrackPrevious` o `Ctrl + Flecha Izquierda`: Cancion anterior del historial.
- Deteccion de pestana: Pausa automatica de musica y locucion al cambiar de ventana (configurable en Ajustes).
