import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Hook modular para gestion del microfono y reconocimiento por voz con Web Speech API.
 * Gestiona compatibilidad entre navegadores (Chrome, Edge vs Opera) y actualiza el texto en vivo.
 */
export default function useVoiceRecognition({ message, setMessage, showAlert }) {
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const recognitionRef = useRef(null);
  const initialTextRef = useRef('');
  const messageRef = useRef(message);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  const toggleListening = useCallback(() => {
    // Opera y Opera GX no tienen servidores de backend para Web Speech API
    const isOpera = (!!window.opr && !!window.opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
    if (isOpera) {
      if (showAlert) {
        showAlert({
          title: "Navegador no compatible",
          message: "Opera y Opera GX no cuentan con servidores para transcribir voz a texto (Web Speech API).\n\nPor favor, abre la aplicación en Google Chrome o Microsoft Edge para usar el micrófono.",
          type: "warning"
        });
      }
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (showAlert) {
        showAlert({
          title: "Reconocimiento no disponible",
          message: "Tu navegador no soporta reconocimiento de voz nativo. Por favor usa Google Chrome o Microsoft Edge.",
          type: "warning"
        });
      }
      return;
    }

    // Si ya está escuchando, detener limpiamente
    if (isListeningRef.current) {
      isListeningRef.current = false;
      setIsListening(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          try { recognitionRef.current.abort(); } catch (e) {}
        }
        recognitionRef.current = null;
      }
      return;
    }

    // Limpiar cualquier instancia previa
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
      recognitionRef.current = null;
    }

    // Guardar texto existente para añadir la voz sin borrar lo que ya escribió el usuario
    initialTextRef.current = messageRef.current ? messageRef.current.trim() : '';

    isListeningRef.current = true;
    setIsListening(true);

    let speechLang = 'es-ES';
    const navLang = navigator.language || '';
    if (navLang) {
      speechLang = navLang.toLowerCase() === 'es' ? 'es-ES' : navLang;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = speechLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("[Mic]: Escuchando activamente en:", speechLang);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i];
        if (item && item[0] && item[0].transcript) {
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }
      }

      const spokenText = (finalTranscript + interimTranscript).trim();
      console.log("[Mic LIVE]:", spokenText);
      if (spokenText && setMessage) {
        const prefix = initialTextRef.current ? `${initialTextRef.current} ` : '';
        setMessage(prefix + spokenText);
      }
    };

    recognition.onerror = (event) => {
      console.warn("[Mic Error]:", event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      if (showAlert) {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          showAlert({
            title: "Permiso Denegado",
            message: "Permiso de micrófono denegado. Permítelo en el icono de candado o permisos junto a la URL en tu navegador.",
            type: "warning"
          });
        } else if (event.error === 'network') {
          showAlert({
            title: "Error de Conexión de Voz",
            message: "Error de conexión con el servicio de voz. Si usas Brave o un bloqueador de anuncios, habilita los servicios de voz de Google en Configuración o prueba en Google Chrome / Microsoft Edge.",
            type: "warning"
          });
        } else if (event.error === 'audio-capture') {
          showAlert({
            title: "Micrófono no Detectado",
            message: "No se detectó audio del micrófono. Comprueba tu micrófono en la configuración de sonido del sistema.",
            type: "warning"
          });
        }
      }
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      console.log("[Mic]: Fin de sesión de micrófono");
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error("[Mic Start Error]:", err);
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current = null;
    }
  }, [showAlert, setMessage]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isListening,
    toggleListening
  };
}
