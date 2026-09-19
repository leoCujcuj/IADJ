import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Send } from 'lucide-react-native';

export default function ChatTab({
  chatHistory,
  loading,
  message,
  setMessage,
  onSendMessage,
  chatScrollRef
}) {
  return (
    <View style={styles.tabContent}>
      <ScrollView
        ref={chatScrollRef}
        style={styles.chatWindow}
        contentContainerStyle={styles.chatScrollContent}
        onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
      >
        {chatHistory.map((msg, idx) => (
          <View
            key={idx}
            style={[
              styles.chatBubble,
              msg.sender === 'dj' ? styles.djBubble : styles.userBubble
            ]}
          >
            <Text style={styles.bubbleAuthor}>{msg.sender === 'dj' ? '🎙️ DJ Gemini' : '👤 Tú'}</Text>
            <Text style={styles.bubbleText}>{msg.text}</Text>
          </View>
        ))}
        {loading && (
          <View style={styles.loadingBubble}>
            <ActivityIndicator size="small" color="#A78BFA" />
            <Text style={styles.loadingBubbleText}>DJ pensando...</Text>
          </View>
        )}
      </ScrollView>
      
      <View style={styles.inputArea}>
        <TextInput
          style={styles.textInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Pídele algo al DJ..."
          placeholderTextColor="#6B7280"
        />
        <TouchableOpacity style={styles.sendButton} onPress={onSendMessage} disabled={loading}>
          <Send color="#FFFFFF" size={20} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
  },
  chatWindow: {
    flex: 1,
    padding: 16,
  },
  chatScrollContent: {
    paddingBottom: 20,
  },
  chatBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  djBubble: {
    backgroundColor: '#1E1E1E',
    alignSelf: 'flex-start',
    borderTopLeftRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#A78BFA',
  },
  userBubble: {
    backgroundColor: '#7C3AED',
    alignSelf: 'flex-end',
    borderTopRightRadius: 4,
  },
  bubbleAuthor: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#D1D5DB',
    marginBottom: 4,
  },
  bubbleText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    marginBottom: 12,
    gap: 8,
  },
  loadingBubbleText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  inputArea: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#111111',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1F1F1F',
  },
  textInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#1F1F1F',
    borderRadius: 22,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    marginRight: 10,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
