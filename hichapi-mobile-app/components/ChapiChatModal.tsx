/**
 * ChapiChatModal — AI chat interface for ordering with Chapi.
 * Full SSE streaming implementation — connects to /api/chat endpoint.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ChatMessage } from '../types/ui';
import { chapiService } from '../services/chapi/ChapiService';

export interface ChapiChatModalProps {
  visible: boolean;
  onClose: () => void;
  restaurantId: string;
  tableId?: string;
}

function ChapiChatModalComponent({
  visible,
  onClose,
  restaurantId,
  tableId,
}: ChapiChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const initialized = useRef(false);

  // Initial greeting
  React.useEffect(() => {
    if (visible && !initialized.current) {
      initialized.current = true;
      const greetingId = `assistant-greeting-${Date.now()}`;
      setMessages([
        {
          id: greetingId,
          role: 'assistant',
          content: '¡Hola! Soy Chapi 🍽️ ¿Qué te apetece hoy? Puedes ver la carta completa, pedirme una recomendación ⭐ o decirme qué quieres y lo agrego al pedido 🙌',
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [visible]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    const assistantId = `assistant-${Date.now()}`;
    let fullResponse = '';

    try {
      await chapiService.streamChat(
        text,
        {
          restaurantId,
          slug: '', // Modal might not have slug, but we should ideally pass it
          tableId,
          conversationHistory: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        },
        (event, data) => {
          if (event === 'token') {
            setIsTyping(false);
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.id === assistantId) {
                return [...prev.slice(0, -1), { ...last, content: data.text }];
              }
              return [
                ...prev,
                {
                  id: assistantId,
                  role: 'assistant',
                  content: data.text,
                  timestamp: new Date().toISOString(),
                },
              ];
            });
          } else if (event === 'done') {
            setIsTyping(false);
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.id === assistantId) {
                return [...prev.slice(0, -1), { ...last, content: data.message }];
              }
              return prev;
            });
          }
        },
        () => {
          setIsTyping(false);
        },
        (error) => {
          console.error('[ChapiChat] Error streaming:', error);
          setIsTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: 'assistant',
              content: 'Lo siento, tuve un problema al procesar tu solicitud. ¿Podrías intentar nuevamente?',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      );
    } catch (error) {
      console.error('[ChapiChat] Error starting stream:', error);
      setIsTyping(false);
    }
  }, [input, isTyping, messages, restaurantId, tableId]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => (
    <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
      <Text style={[styles.bubbleText, item.role === 'user' ? styles.userText : styles.assistantText]}>
        {item.content}
      </Text>
    </View>
  ), []);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🤖 Chapi</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Cerrar chat"
            accessibilityRole="button"
          >
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                ¡Hola! Soy Chapi, tu asistente de pedidos. ¿En qué puedo ayudarte?
              </Text>
            </View>
          }
        />

        {/* Typing indicator */}
        {isTyping && (
          <View style={styles.typingIndicator}>
            <ActivityIndicator size="small" color="#FF6B35" />
            <Text style={styles.typingText}>Chapi está escribiendo…</Text>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Escribe tu mensaje…"
            placeholderTextColor="#9CA3AF"
            returnKeyType="send"
            onSubmitEditing={handleSend}
            accessibilityLabel="Campo de mensaje para Chapi"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || isTyping) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || isTyping}
            accessibilityLabel="Enviar mensaje"
            accessibilityRole="button"
          >
            <Text style={styles.sendButtonText}>→</Text>
          </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  closeButton: { fontSize: 18, color: '#6B7280', padding: 4 },
  messageList: { padding: 16, gap: 8 },
  bubble: { maxWidth: '80%', borderRadius: 12, padding: 12, marginVertical: 4 },
  userBubble: { backgroundColor: '#FF6B35', alignSelf: 'flex-end' },
  assistantBubble: { backgroundColor: '#fff', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#E5E7EB' },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#fff' },
  assistantText: { color: '#111827' },
  emptyState: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  emptyStateText: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  typingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  typingText: { fontSize: 13, color: '#6B7280' },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#FF6B3580' },
  sendButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});

export const ChapiChatModal = React.memo(ChapiChatModalComponent);
export default ChapiChatModal;
