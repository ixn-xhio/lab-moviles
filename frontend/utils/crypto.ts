import 'react-native-get-random-values';
import nacl from 'tweetnacl';
import { encode as encodeUTF8, decode as decodeUTF8 } from '@stablelib/utf8';
import { encode as encodeBase64, decode as decodeBase64 } from '@stablelib/base64';

export function generateKeyPair() {
  const kp = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(kp.publicKey),
    secretKey: encodeBase64(kp.secretKey),
  };
}

export function encryptDM(message: string, recipientPublicKeyB64: string, mySecretKeyB64: string): string {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(
    encodeUTF8(message),
    nonce,
    decodeBase64(recipientPublicKeyB64),
    decodeBase64(mySecretKeyB64)
  );
  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);
  return encodeBase64(combined);
}

export function decryptDM(ciphertextB64: string, senderPublicKeyB64: string, mySecretKeyB64: string): string | null {
  try {
    const data = decodeBase64(ciphertextB64);
    const nonce = data.slice(0, nacl.box.nonceLength);
    const box = data.slice(nacl.box.nonceLength);
    const result = nacl.box.open(box, nonce, decodeBase64(senderPublicKeyB64), decodeBase64(mySecretKeyB64));
    return result ? decodeUTF8(result) : null;
  } catch (e) {
    return null;
  }
}

export function encryptGroup(message: string, groupKeyB64: string): string {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const encrypted = nacl.secretbox(encodeUTF8(message), nonce, decodeBase64(groupKeyB64));
  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);
  return encodeBase64(combined);
}

export function decryptGroup(ciphertextB64: string, groupKeyB64: string): string | null {
  try {
    const data = decodeBase64(ciphertextB64);
    const nonce = data.slice(0, nacl.secretbox.nonceLength);
    const box = data.slice(nacl.secretbox.nonceLength);
    const result = nacl.secretbox.open(box, nonce, decodeBase64(groupKeyB64));
    return result ? decodeUTF8(result) : null;
  } catch (e) {
    return null;
  }
}