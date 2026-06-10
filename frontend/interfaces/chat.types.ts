export interface ChatUser {
  id: string;
  nickname: string;
  joined_at: string;
  is_online: boolean;
  public_key?: string | null;
}

export interface MediaAttachment {
  url: string;
  filename: string;
  mime_type: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_nickname: string;
  content: string;
  type: 'group' | 'dm';
  recipient_id?: string | null;
  timestamp: string;
  ttl?: number | null;
  expires_at?: string | null;
  allow_read_receipt: boolean;
  media?: MediaAttachment | null;
}

export type WsEvent =
  | { type: 'group_key'; key: string }
  | { type: 'users_list'; users: ChatUser[] }
  | { type: 'user_joined'; user: ChatUser }
  | { type: 'user_left'; user_id: string }
  | { type: 'group_message'; message: ChatMessage }
  | { type: 'group_history'; messages: ChatMessage[] }
  | { type: 'dm'; message: ChatMessage }
  | { type: 'typing'; user_id: string; nickname: string }
  | { type: 'stop_typing'; user_id: string }
  | { type: 'message_seen'; message_id: string; seen_by: string; seen_at: string }
  | { type: 'message_expired'; message_id: string }
  | { type: 'pong' }
  | { type: 'error'; message: string };