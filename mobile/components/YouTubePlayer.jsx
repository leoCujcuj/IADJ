import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { Music } from 'lucide-react-native';

export default function YouTubePlayer({ videoId, onVideoEnded, onPreloadTrigger }) {
  const getYouTubeHtml = (id) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          body { margin: 0; background-color: #000000; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
          iframe { width: 100%; height: 100%; border: none; }
        </style>
      </head>
      <body>
        <div id="player"></div>
        <script>
          var tag = document.createElement('script');
          tag.src = "https://www.youtube.com/iframe_api";
          var firstScriptTag = document.getElementsByTagName('script')[0];
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

          var player;
          var preloadSent = false;
          function onYouTubeIframeAPIReady() {
            player = new YT.Player('player', {
              height: '100%',
              width: '100%',
              videoId: '${id}',
              playerVars: {
                'playsinline': 1,
                'autoplay': 1,
                'controls': 1,
                'origin': '*'
              },
              events: {
                'onStateChange': onPlayerStateChange
              }
            });

            setInterval(function() {
              if (player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
                var dur = player.getDuration();
                var cur = player.getCurrentTime();
                if (dur > 35 && (dur - cur) <= 30 && !preloadSent) {
                  preloadSent = true;
                  window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'preload_30s' }));
                }
              }
            }, 1000);
          }

          function onPlayerStateChange(event) {
            if (event.data === 0) { // Video finished
              window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'ended' }));
            }
          }
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.webViewContainer}>
      {videoId ? (
        <WebView
          source={{ html: getYouTubeHtml(videoId) }}
          style={styles.webView}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.event === 'preload_30s' && onPreloadTrigger) {
                onPreloadTrigger();
              } else if (data.event === 'ended' && onVideoEnded) {
                onVideoEnded();
              }
            } catch (e) {
              console.error('WebView message error:', e);
            }
          }}
        />
      ) : (
        <View style={styles.webViewPlaceholder}>
          <Music color="#4B5563" size={64} />
          <Text style={styles.placeholderText}>Sintonizando la frecuencia...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  webViewContainer: {
    width: '100%',
    height: 220,
    backgroundColor: '#000000',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  webView: {
    flex: 1,
  },
  webViewPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#161616',
    gap: 12,
  },
  placeholderText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
