import { ChatUser, ChatMessage } from '@/interfaces/chat.types';

export const BASE_HTTP_URL = 'http://74.220.28.80';
export const BASE_WS_URL = 'http://74.220.28.80';

export class ChatApiService {
  static async join(nickname: string): Promise<{ user: ChatUser; token: string }> {
    const response = await fetch(`${BASE_HTTP_URL}/api/chat/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: { message: 'Fallo al autenticar' } }));
      throw new Error(err.detail?.message || 'Error del servidor');
    }
    return response.json();
  }

  static async registerPublicKey(token: string, publicKey: string): Promise<void> {
    const response = await fetch(`${BASE_HTTP_URL}/api/chat/users/me/public-key`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ public_key: publicKey }),
    });
    if (!response.ok) {
      throw new Error('No se pudo registrar la llave pública en el API.');
    }
  }

  static async getGroupMessages(token: string): Promise<ChatMessage[]> {
    const response = await fetch(`${BASE_HTTP_URL}/api/chat/messages`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) return [];
    return response.json();
  }
}

export { ChatMessage, ChatUser };
