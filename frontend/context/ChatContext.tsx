import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { ChatUser, ChatMessage, WsEvent } from '@/interfaces/chat.types';
import { ChatApiService, BASE_WS_URL } from '@/services/chatService';
import { generateKeyPair, encryptGroup, decryptGroup, encryptDM, decryptDM } from '@/utils/crypto';
import { saveKeyPair, loadKeyPair } from '@/utils/storage';

interface ChatContextData {
  currentUser: ChatUser | null;
  token: string | null;
  onlineUsers: ChatUser[];
  groupMessages: ChatMessage[];
  directMessages: Record<string, ChatMessage[]>;
  activeChatUser: ChatUser | null;
  typingUsers: Record<string, string>;
  joinChat: (nickname: string) => Promise<void>;
  sendGroupMessage: (content: string) => void;
  sendDirectMessage: (userId: string, content: string) => void;
  setActiveChatUser: (user: ChatUser | null) => void;
  sendTyping: (recipientId?: string) => void;
  sendStopTyping: () => void;
}

const ChatContext = createContext<ChatContextData | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<ChatUser[]>([]);
  const [groupMessages, setGroupMessages] = useState<ChatMessage[]>([]);
  const [directMessages, setDirectMessages] = useState<Record<string, ChatMessage[]>>({});
  const [activeChatUser, setActiveChatUser] = useState<ChatUser | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [userPublicKeys, setUserPublicKeys] = useState<Record<string, string>>({});
  const [myKeyPair, setMyKeyPair] = useState<{ publicKey: string | null; secretKey: string | null }>({
    publicKey: null,
    secretKey: null,
  });

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (groupKey && groupMessages.length > 0) {
      setGroupMessages(prev =>
        prev.map(msg => {
          if (msg.content && !msg.content.includes(' ')) {
            const decrypted = decryptGroup(msg.content, groupKey);
            if (decrypted) return { ...msg, content: decrypted };
          }
          return msg;
        })
      );
    }
  }, [groupKey]);

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${BASE_WS_URL}/ws/${token}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const event: WsEvent = JSON.parse(e.data);
        switch (event.type) {
          case 'group_key':
            setGroupKey(event.key || null);
            break;
          case 'users_list':
            setUserPublicKeys(prev => {
              const updated = { ...prev };
              event.users.forEach(u => { if (u.public_key) updated[u.id] = u.public_key; });
              return updated;
            });
            setOnlineUsers(event.users);
            break;
          case 'user_joined':
            if (event.user.public_key) {
              setUserPublicKeys(prev => ({ ...prev, [event.user.id]: event.user.public_key! }));
            }
            setOnlineUsers(prev => [...prev.filter(u => u.id !== event.user.id), event.user]);
            break;
          case 'user_left':
            setOnlineUsers(prev => prev.filter(u => u.id !== event.user_id));
            break;
          case 'group_message': {
            const plaintext = groupKey ? decryptGroup(event.message.content, groupKey) : event.message.content;
            setGroupMessages(prev => [...prev, { ...event.message, content: plaintext ?? '[mensaje no descifrable]' }]);
            break;
          }
          case 'group_history':
            setGroupMessages(event.messages);
            break;
          case 'dm': {
            if (currentUser && event.message.sender_id === currentUser.id) return;
            const senderId = event.message.sender_id;
            setUserPublicKeys(currentKeys => {
              const senderKey = currentKeys[senderId];
              const plaintext = senderKey && myKeyPair.secretKey
                ? decryptDM(event.message.content, senderKey, myKeyPair.secretKey)
                : null;
              
              setDirectMessages(prev => ({
                ...prev,
                [senderId]: [...(prev[senderId] ?? []), { ...event.message, content: plaintext ?? '[mensaje no descifrable]' }]
              }));
              return currentKeys;
            });
            break;
          }
          case 'typing':
            setTypingUsers(prev => ({ ...prev, [event.user_id]: event.nickname }));
            break;
          case 'stop_typing':
            setTypingUsers(prev => {
              const copy = { ...prev };
              delete copy[event.user_id];
              return copy;
            });
            break;
          case 'message_expired':
            setGroupMessages(prev => prev.filter(m => m.id !== event.message_id));
            break;
        }
      } catch (err) {
        console.error('Error procesando evento WS:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [token, groupKey, myKeyPair, currentUser]);

  const joinChat = async (nickname: string) => {
    try {
      const data = await ChatApiService.join(nickname);
      setToken(data.token);
      setCurrentUser(data.user);

      let kp = await loadKeyPair();
      if (!kp.secretKey || !kp.publicKey) {
        const newKp = generateKeyPair();
        await saveKeyPair(newKp);
        kp = newKp;
      }
      setMyKeyPair(kp);

      await ChatApiService.registerPublicKey(data.token, kp.publicKey!);
      const history = await ChatApiService.getGroupMessages(data.token);
      setGroupMessages(history);
    } catch (error: any) {
      Alert.alert('Error de conexión', error.message || 'Error al iniciar chat');
    }
  };

  const sendGroupMessage = (content: string) => {
    const messageToSend = groupKey ? encryptGroup(content, groupKey) : content;
    if (messageToSend.length > 1000) {
      Alert.alert('Mensaje demasiado largo', 'El tamaño cifrado supera el límite del backend.');
      return;
    }
    wsRef.current?.send(JSON.stringify({ type: 'group_message', content: messageToSend }));
  };

  const sendDirectMessage = (userId: string, content: string) => {
    const recipientKey = userPublicKeys[userId];
    if (!recipientKey || !myKeyPair.secretKey || !currentUser) return;
    const ciphertext = encryptDM(content, recipientKey, myKeyPair.secretKey);
    if (ciphertext.length > 1000) {
      Alert.alert('Mensaje demasiado largo', 'Reduce el texto antes de transmitir.');
      return;
    }
    wsRef.current?.send(JSON.stringify({ type: 'dm', to: userId, content: ciphertext }));

    setDirectMessages(prev => ({
      ...prev,
      [userId]: [...(prev[userId] ?? []), {
        id: `send-${Date.now()}`,
        sender_id: currentUser.id,
        sender_nickname: currentUser.nickname,
        content,
        type: 'dm',
        recipient_id: userId,
        timestamp: new Date().toISOString(),
        allow_read_receipt: true,
      }],
    }));
  };

  const sendTyping = (recipientId?: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'typing', to: recipientId }));
  };

  const sendStopTyping = () => {
    wsRef.current?.send(JSON.stringify({ type: 'stop_typing' }));
  };

  return (
    <ChatContext.Provider value={{ currentUser, token, onlineUsers, groupMessages, directMessages, activeChatUser, typingUsers, joinChat, sendGroupMessage, sendDirectMessage, setActiveChatUser, sendTyping, sendStopTyping }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat debe llamarse dentro de un ChatProvider');
  return context;
};