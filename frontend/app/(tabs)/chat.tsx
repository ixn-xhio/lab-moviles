import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useChat } from '@/context/ChatContext';

export default function ChatTab() {
  const { currentUser, onlineUsers, groupMessages, directMessages, activeChatUser, joinChat, sendGroupMessage, sendDirectMessage, setActiveChatUser, typingUsers, sendTyping, sendStopTyping } = useChat();
  const [nickname, setNickname] = useState('');
  const [inputText, setInputText] = useState('');
  const [viewMode, setViewMode] = useState<'group' | 'dm_list' | 'dm_chat'>('group');
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    if (inputText.trim().length > 0) {
      sendTyping(activeChatUser?.id);
    } else {
      sendStopTyping();
    }
  }, [inputText]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    if (viewMode === 'group') {
      sendGroupMessage(inputText.trim());
    } else if (viewMode === 'dm_chat' && activeChatUser) {
      sendDirectMessage(activeChatUser.id, inputText.trim());
    }
    setInputText('');
  };

  if (!currentUser) {
    return (
      <View style={styles.center}>
        <Text style={styles.titleLabel}>Ingresar al Chat Encriptado</Text>
        <TextInput style={styles.input} placeholder="Tu Nickname..." placeholderTextColor="#9CA3AF" value={nickname} onChangeText={setNickname} />
        <TouchableOpacity style={styles.btnAction} onPress={() => nickname.trim() && joinChat(nickname.trim())}>
          <Text style={styles.btnText}>Conectar al Servidor</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const messagesToShow = viewMode === 'group' ? groupMessages : (activeChatUser ? directMessages[activeChatUser.id] || [] : []);
  const typers = Object.values(typingUsers);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <View style={styles.navBar}>
        <TouchableOpacity style={[styles.navBtn, viewMode === 'group' && styles.navBtnActive]} onPress={() => setViewMode('group')}>
          <Text style={styles.navText}>Grupo General</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtn, (viewMode === 'dm_list' || viewMode === 'dm_chat') && styles.navBtnActive]} onPress={() => setViewMode('dm_list')}>
          <Text style={styles.navText}>Mensajes Directos</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'dm_list' ? (
        <FlatList
          data={onlineUsers.filter(u => u.id !== currentUser.id)}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.userRow} onPress={() => { setActiveChatUser(item); setViewMode('dm_chat'); }}>
              <View style={styles.onlineIndicator} />
              <Text style={styles.userRowText}>{item.nickname}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay otros estudiantes en línea.</Text>}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatRef}
            data={messagesToShow}
            keyExtractor={(item, index) => item.id + index}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isMe = item.sender_id === currentUser.id;
              return (
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                  {!isMe && <Text style={styles.bubbleAuthor}>{item.sender_nickname}</Text>}
                  <Text style={{ color: isMe ? '#FFF' : '#111', fontSize: 15 }}>{item.content}</Text>
                </View>
              );
            }}
          />
          {typers.length > 0 && <Text style={styles.typingText}>{typers.join(', ')} está escribiendo...</Text>}
          <View style={styles.footerInput}>
            <TextInput style={styles.barInput} placeholder="Escribe un mensaje seguro..." value={inputText} onChangeText={setInputText} />
            <TouchableOpacity style={styles.btnSend} onPress={handleSend}>
              <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Enviar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  titleLabel: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  input: { backgroundColor: '#FFF', width: '100%', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB', marginBottom: 12, color: '#000' },
  btnAction: { backgroundColor: '#16A34A', padding: 14, borderRadius: 12, width: '100%', alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: 'bold' },
  navBar: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#E5E7EB', padding: 4, borderRadius: 12, marginBottom: 12 },
  navBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  navBtnActive: { backgroundColor: '#FFF' },
  navText: { fontWeight: '600', color: '#374151' },
  userRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, marginHorizontal: 16, borderRadius: 12, marginBottom: 8 },
  onlineIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 12 },
  userRowText: { fontSize: 16, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 24 },
  bubble: { padding: 12, borderRadius: 16, marginVertical: 4, marginHorizontal: 16, maxWidth: '75%' },
  bubbleMe: { backgroundColor: '#16A34A', alignSelf: 'flex-end', borderBottomRightRadius: 0 },
  bubbleThem: { backgroundColor: '#FFF', alignSelf: 'flex-start', borderBottomLeftRadius: 0, borderWidth: 1, borderColor: '#E5E7EB' },
  bubbleAuthor: { fontSize: 11, fontWeight: 'bold', color: '#6B7280', marginBottom: 2 },
  typingText: { fontStyle: 'italic', color: '#16A34A', marginLeft: 16, marginBottom: 4, fontSize: 12 },
  footerInput: { flexDirection: 'row', padding: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB', alignItems: 'center' },
  barInput: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, color: '#000' },
  btnSend: { backgroundColor: '#16A34A', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18 }
});