import * as SecureStore from 'expo-secure-store';

export const saveKeyPair = async (kp: { secretKey: string; publicKey: string }): Promise<void> => {
  await SecureStore.setItemAsync('secretKey', kp.secretKey);
  await SecureStore.setItemAsync('publicKey', kp.publicKey);
};

export const loadKeyPair = async (): Promise<{ secretKey: string | null; publicKey: string | null }> => {
  const secretKey = await SecureStore.getItemAsync('secretKey');
  const publicKey = await SecureStore.getItemAsync('publicKey');
  return { secretKey, publicKey };
};