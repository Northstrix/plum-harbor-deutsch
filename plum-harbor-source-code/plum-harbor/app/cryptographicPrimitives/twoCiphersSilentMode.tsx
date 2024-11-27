"use client";

import { encryptSerpent256ECB, decryptSerpent256ECB } from '@/app/cryptographicPrimitives/serpent';
import { createSHA512, createHMAC, whirlpool, argon2id, sha512 } from 'hash-wasm';
import { ChaCha20 } from 'mipher';

export const silentlyDecryptDataWithTwoCiphersCBC = async (
    bytes: Uint8Array, 
    password: Uint8Array, 
    iterations: number
): Promise<[Uint8Array, boolean]> => {
    const chunkSize = 16;
    const salt = bytes.slice(0, 32);
    const derivedKey = await derive416BytesUsingArgon2id(password, salt, iterations);
    let chacha20key = new Uint8Array(derivedKey.slice(0, 64));
    const blockCipherKey = derivedKey.slice(64, 96);
    const hmacKey = derivedKey.slice(96, 224);
  
    const extractedIV = bytes.slice(32, 48);
    const decryptedIV = await decryptSerpent256ECB(extractedIV, blockCipherKey);
    let previousCiphertext = decryptedIV;
  
    const decryptedData: number[] = [];
    const dataLengthNoLC = bytes.length;
    for (let i = 48; i < dataLengthNoLC; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      const decryptedChunk = await decryptSerpent256ECB(chunk, blockCipherKey);
      const xorChunk = decryptedChunk.map((byte, index) => byte ^ previousCiphertext[index]);
      xorChunk.forEach(byte => decryptedData.push(byte));
      previousCiphertext = chunk;
    }
  
    const decryptedDataUint8Array = new Uint8Array(decryptedData);
  
    const chunkSizeForStreamCipher = 256 * 1024; // 256 KB chunks
    let streamCipherOffset = 0;
    const decryptedTag = new Uint8Array(64);
    const decryptedChunks = new Uint8Array(decryptedDataUint8Array.length - 64);
    let decryptedOffset = 0;
    
    let isFirstChunk = true;
    
    while (streamCipherOffset < decryptedDataUint8Array.length) {
      const input = Array.from(chacha20key).map(byte => byte.toString(16).padStart(2, '0')).join('');
      const sha512_output = await sha512(input);
      const sha512Array = hexStringToArray(sha512_output);
      const byteArray = new Uint8Array(sha512Array);
      const generatedHash = await whirlpool(byteArray);
      chacha20key = new Uint8Array(hexStringToArray(generatedHash));
    
      const chunk = decryptedDataUint8Array.slice(streamCipherOffset, Math.min(streamCipherOffset + chunkSizeForStreamCipher, decryptedDataUint8Array.length));
      const nonce = chacha20key.slice(32, 40);
      const chacha20 = new ChaCha20();
      const decryptedChunk = chacha20.decrypt(chacha20key.slice(0, 32), chunk, nonce);
    
      if (isFirstChunk) {
        decryptedTag.set(decryptedChunk.slice(0, 64));
        decryptedChunks.set(decryptedChunk.slice(64), 0);
        decryptedOffset = decryptedChunk.length - 64;
        isFirstChunk = false;
      } else {
        decryptedChunks.set(decryptedChunk, decryptedOffset);
        decryptedOffset += decryptedChunk.length;
      }
    
      streamCipherOffset += chunk.length;
    }
    const decryptedWithStreamCipher = decryptedChunks.slice(0, decryptedOffset);
    const newTag = await computeTagForDataUsingHMACSHA512(hmacKey, decryptedWithStreamCipher);
    let integrityFailed = false;
    for (let i = 0; i < 64; i++) {
      if (decryptedTag[i] !== newTag[i]) {
        integrityFailed = true;
        break;
      }
    }
    return [decryptedWithStreamCipher, integrityFailed];
    }


export const silentlyEncryptDataWithTwoCiphersCBC = async (
    bytes: Uint8Array,
    password: Uint8Array,
    iterations: number
): Promise<Uint8Array> => {
    const salt = window.crypto.getRandomValues(new Uint8Array(32));
    const encryptedChunks: Uint8Array[] = [];
    encryptedChunks.push(salt);
    const derivedKey = await derive416BytesUsingArgon2id(password, salt, iterations);
    const chunkSize = 256 * 1024; // 256 KB chunks
    let offset = 0;
    let chacha20key = new Uint8Array(derivedKey.slice(0, 64));
    const blockCipherKey = derivedKey.slice(64, 96);
    const hmacKey = derivedKey.slice(96, 224);
    const tag = await computeTagForDataUsingHMACSHA512(hmacKey, bytes);

    const tag_and_data = new Uint8Array(tag.length + bytes.length);
    tag_and_data.set(tag, 0);
    tag_and_data.set(bytes, tag.length);


    const encryptedData = new Uint8Array(tag_and_data.length);
  
    const totalSize = tag_and_data.length;
    while (offset < totalSize) {
      const input = Array.from(chacha20key).map(byte => byte.toString(16).padStart(2, '0')).join('');
      const sha512_output = await sha512(input);
      const sha512Array = hexStringToArray(sha512_output);
      const byteArray = new Uint8Array(sha512Array);
      const generatedHash = await whirlpool(byteArray);
      chacha20key = new Uint8Array(hexStringToArray(generatedHash));
  
      const chunk = tag_and_data.slice(offset, Math.min(offset + chunkSize, totalSize));
      const nonce = chacha20key.slice(32, 40);
      const chacha20 = new ChaCha20();
      const encryptedChunk = chacha20.encrypt(chacha20key.slice(0, 32), chunk, nonce);
  
      for (let i = 0; i < encryptedChunk.length; i++) {
        encryptedData[offset + i] = encryptedChunk[i];
      }
      offset += chunk.length;
    }

    const blockcipher_chunk_size = 16;
    const iv = window.crypto.getRandomValues(new Uint8Array(16));
    const encryptedIV = await encryptSerpent256ECB(iv, blockCipherKey);
    encryptedChunks.push(encryptedIV);
    let previousCiphertext = iv;
    for (let i = 0; i < encryptedData.length; i += blockcipher_chunk_size) {
      let chunk = encryptedData.slice(i, i + blockcipher_chunk_size);
      if (chunk.length < blockcipher_chunk_size) {
        const padding = blockcipher_chunk_size - chunk.length;
        const paddedChunk = new Uint8Array(blockcipher_chunk_size);
        paddedChunk.set(chunk);
        paddedChunk.fill(padding, chunk.length);
        chunk = paddedChunk;
      }
      const xorChunk = chunk.map((byte, index) => byte ^ previousCiphertext[index]);
      const encryptedChunk = await encryptSerpent256ECB(xorChunk, blockCipherKey);
      encryptedChunks.push(encryptedChunk);
      previousCiphertext = encryptedChunk;
    }
  
    const totalLength = encryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let soffset = 0;
    for (const chunk of encryptedChunks) {
      result.set(chunk, soffset);
      soffset += chunk.length;
    }
  
    return result;
  }

  const computeTagForDataUsingHMACSHA512 = async (key: Uint8Array ,data: Uint8Array) => {
    const hmac = await createHMAC(createSHA512(), key);
    hmac.init();
    hmac.update(data);
    const signature = hmac.digest('binary');
    return new Uint8Array(signature);
  };

  const hexStringToArray = (hexString: string): number[] => {
    // Check if the input is a valid hex string
    if (!/^[0-9A-Fa-f]+$/.test(hexString)) {
        throw new Error("Invalid hex string");
    }

    if (hexString.length % 2 !== 0) {
        throw new Error("Invalid hex string length");
    }

    const resultArray: number[] = [];
    for (let i = 0; i < hexString.length; i += 2) {
        const hexPair = hexString.substring(i, i + 2);
        resultArray.push(parseInt(hexPair, 16)); // Convert hex pair to integer
    }

    return resultArray;
};

const derive416BytesUsingArgon2id = async (password: Uint8Array, salt: Uint8Array, iterations: number) => {
    const derivedKey = await argon2id({
      password,
      salt,
      parallelism: 1,
      iterations,
      memorySize: 512,
      hashLength: 416,
      outputType: 'binary',
    });
    return new Uint8Array(derivedKey);
  };