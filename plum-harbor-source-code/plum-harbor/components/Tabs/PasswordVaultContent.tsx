"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { encryptSerpent256ECB, decryptSerpent256ECB } from '@/app/cryptographicPrimitives/serpent';
import { createSHA512, createHMAC, whirlpool, argon2id, sha512 } from 'hash-wasm';
import { ChaCha20 } from 'mipher';
import useStore from '@/store/store';
import { db, auth } from '@/app/lib/firebase';
import { doc, setDoc, getDocs, deleteDoc, collection } from "firebase/firestore"; 
import FishyButton from '@/components/ui/FishyButton/FishyButton';
import styles from './TabSwitcher.module.css';


interface EncryptedLogin {
  title: string;
  login: string;
  password: string;
  website: string;
  tag: string;
}

interface DecryptedLogin {
  id: string;
  title: string;
  login: string;
  password: string;
  website: string;
  integrity: boolean;
}

export default function PasswordVaultContent() {
  const [logins, setLogins] = useState<DecryptedLogin[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'view'>('add');
  const [currentRecord, setCurrentRecord] = useState<DecryptedLogin | null>(null);
  const { masterKey, username, iterations } = useStore();
  const [isScrollable, setIsScrollable] = useState(false);
  const linesRef = useRef<HTMLDivElement>(null);
  const [showConfirmPopUp, setShowConfirmPopUp] = useState(false);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [popupMessageLine1, setPopupMessageLine1] = useState('');
  const [popupMessageLine2, setPopupMessageLine2] = useState('');
  
const executionRef = useRef(false);
const notificationContainerRef = React.useRef<HTMLDivElement | null>(null);

type NotificationType = 'help' | 'success' | 'warning' | 'error';

const createNotification = (type: NotificationType, notificationTitle: string, notificationContent: string) => {
  if (notificationContainerRef.current) {
      const notif = document.createElement('div');
      notif.classList.add(styles.toast, styles[type]); // Ensure styles is properly imported

      // Create title and content
      const title = document.createElement('h3');
      title.textContent = notificationTitle;
      title.style.margin = '0';

      const content = document.createElement('p');
      content.textContent = notificationContent;
      content.style.margin = '0.25rem 0';

      // Create timer and close button
      const timerContainer = document.createElement('div');
      timerContainer.classList.add(styles.timer);

      const closeButton = document.createElement('button');
      closeButton.textContent = '✖';
      closeButton.classList.add(styles.closeButton);
      closeButton.onclick = () => { removeNotification(notif); };

      // Append elements to notification
      notif.appendChild(closeButton);
      notif.appendChild(title);
      notif.appendChild(content);
      notif.appendChild(timerContainer);

      // Create timer divs
      const timerLeft = document.createElement('div');
      timerLeft.classList.add(styles.timerLeft);

      const timerRight = document.createElement('div');
      timerRight.classList.add(styles.timerRight);

      // Append timer halves in swapped order
      timerContainer.appendChild(timerRight);
      timerContainer.appendChild(timerLeft);

      // Append notification to container
      notificationContainerRef.current.appendChild(notif);

      // Trigger animations for appearance
      notif.style.animation = 'slideInWithBounce 0.6s ease forwards';
      
      const duration = 5000; // Set duration to 5 seconds

      // Generate a unique ID for this notification (only once)
      const uniqueId = Date.now();

      // Set initial animation for both sides of the timer with uniqueId
      setTimerAnimation(timerLeft, timerRight, duration, uniqueId);

      // Set timeout to remove notification after duration
      let timeoutId: NodeJS.Timeout;
      
      timeoutId = setTimeout(() => removeNotification(notif), duration);
      
      let remainingTime = duration; // Track remaining time

      // Pause timer on hover and store remaining time
      notif.addEventListener("mouseenter", () => {
          clearTimeout(timeoutId);  // Stop the timeout
          
          const computedWidth = parseFloat(getComputedStyle(timerLeft).width);
          const totalWidth = parseFloat(getComputedStyle(timerContainer).width);
          const elapsedTime = (computedWidth / totalWidth) * duration; // Calculate elapsed time
          
          remainingTime = duration - elapsedTime; // Calculate remaining time
          (timerLeft as HTMLElement).style.animationPlayState = "paused";
          (timerRight as HTMLElement).style.animationPlayState = "paused";
      });

      // Resume timer on mouse leave with restored remaining time
      notif.addEventListener("mouseleave", () => {
          if (remainingTime > 0) {
              setTimerAnimation(timerLeft, timerRight, duration, uniqueId);
              timeoutId = setTimeout(() => removeNotification(notif), duration - remainingTime);
              (timerLeft as HTMLElement).style.animationPlayState = "running";
              (timerRight as HTMLElement).style.animationPlayState = "running";
          }
      });
  }
};

const setTimerAnimation = (timerLeft: HTMLElement, timerRight: HTMLElement, duration: number, uniqueId: number) => {
  const stylesheet = document.createElement("style");
  stylesheet.type = "text/css";
  stylesheet.innerHTML = `
    @keyframes timerShrink-${uniqueId} {
        from { width: 100%; }
        to { width: 0; }
    }
  `;
  document.head.appendChild(stylesheet);

  // Start animations with full width
  timerLeft.style.animation = `timerShrink-${uniqueId} ${duration}ms linear forwards`;
  timerRight.style.animation = `timerShrink-${uniqueId} ${duration}ms linear forwards`;
};

const removeNotification = (notif: HTMLElement) => {
  notif.style.animation = 'slideOutWithBounce 0.6s ease forwards'; 

  setTimeout(() => {
     notif.remove();
  }, 600); 
};

// Dynamically create keyframes for animations in JavaScript
React.useEffect(() => {
  const stylesheet = document.createElement("style");
  stylesheet.type = "text/css";
  
  stylesheet.innerHTML = `
      @keyframes slideInWithBounce {
        0% { transform: translateX(150%); opacity: 0; }
        60% { transform: translateX(-12%); opacity: 1; }
        100% { transform: translateX(0); opacity: 1; }
      }

      @keyframes slideOutWithBounce {
        0% { transform: translateX(0); opacity: 1; }
        40% { transform: translateX(-12%); opacity: 1; }
        100% { transform: translateX(150%); opacity: 0; }
      }
  `;
  
  document.head.appendChild(stylesheet);
  
  return () => {
      document.head.removeChild(stylesheet); 
  };
}, []);



const extractRecordsFromFirebase = () => {
  if (executionRef.current) {
    return;
  }
  executionRef.current = true;
  const fetchLogins = async () => {
    showTwoLinedPopup("Fetching your records", "Please wait for a while");

    try {
      const user = auth.currentUser;
      if (!auth.currentUser) {
        setShowForm(false);
        showTwoLinedPopup('Authentication Error', 'Oops! It looks like your session has expired. Please refresh the page and try logging in again.');
        await new Promise(() => {});
        throw new Error('User not authenticated');
      }
      if (!user) throw new Error('User not authenticated');

      const loginsRef = collection(db, `data/${user.email}/private/encrypted/logins`);
      const querySnapshot = await getDocs(loginsRef);
      let fileIndex = 0; // Initialize fileIndex

      // Create a set to track processed IDs
      const processedIds = new Set<string>();

      // Process each document in the query snapshot
      for (const doc of querySnapshot.docs) {
        const data = doc.data() as EncryptedLogin;
        fileIndex++;

        // Show pop-up for decrypting each record
        showTwoLinedPopup(`Decrypting record N${fileIndex}/${querySnapshot.docs.length}`, "Please wait for a while");

        // Check if this ID has already been processed
        if (processedIds.has(doc.id)) {
          console.warn(`Record with ID ${doc.id} has already been processed. Skipping.`);
          continue; // Skip this record if it's already processed
        }

        try {
          const new_iterations: number = Math.round(250 + (iterations / 20));

          let integrityCheckPassed = false;

          // Check if tag is valid
          const isTagValid = data.tag && typeof data.tag === 'string' && data.tag.length === 224 && /^[0-9A-Fa-f]+$/.test(data.tag);
          
          // Function to check if a field is valid
          const isFieldValid = (field: string | undefined): boolean => {
            return field !== undefined &&
                   typeof field === 'string' &&
                   field.length >= 128 &&
                   field.length % 32 === 0 &&
                   /^[0-9A-Fa-f]+$/.test(field);
          };
          
          let decryptedTitle = "Missing Ciphertext";
          let decryptedLogin = "Missing Ciphertext";
          let decryptedPassword = "Missing Ciphertext";
          let decryptedWebsite = "Missing Ciphertext";
          
          let isTitleDecrypted = false;
          let isLoginDecrypted = false;
          let isPasswordDecrypted = false;
          let isWebsiteDecrypted = false;
          
          // Decrypt fields only if they are present and valid
          if (data.title) {
            if (isFieldValid(data.title)) {
              try {
                const decryptedTitleArray = await decryptFieldValueWithTwoCiphersCBC(
                  data.title,
                  masterKey,
                  new_iterations
                );
                decryptedTitle = new TextDecoder().decode(new Uint8Array(decryptedTitleArray));
                isTitleDecrypted = true;
              } catch (error) {
                console.error("Error decrypting title:", error);
                decryptedTitle = "Incorrect Ciphertext";
              }
            } else {
              decryptedTitle = "Incorrect Ciphertext";
            }
          }
          
          if (data.login) {
            if (isFieldValid(data.login)) {
              try {
                const decryptedLoginArray = await decryptFieldValueWithTwoCiphersCBC(
                  data.login,
                  masterKey,
                  new_iterations
                );
                decryptedLogin = new TextDecoder().decode(new Uint8Array(decryptedLoginArray));
                isLoginDecrypted = true;
              } catch (error) {
                console.error("Error decrypting login:", error);
                decryptedLogin = "Incorrect Ciphertext";
              }
            } else {
              decryptedLogin = "Incorrect Ciphertext";
            }
          }
          
          if (data.password) {
            if (isFieldValid(data.password)) {
              try {
                const decryptedPasswordArray = await decryptFieldValueWithTwoCiphersCBC(
                  data.password,
                  masterKey,
                  new_iterations
                );
                decryptedPassword = new TextDecoder().decode(new Uint8Array(decryptedPasswordArray));
                isPasswordDecrypted = true;
              } catch (error) {
                console.error("Error decrypting password:", error);
                decryptedPassword = "Incorrect Ciphertext";
              }
            } else {
              decryptedPassword = "Incorrect Ciphertext";
            }
          }
          
          if (data.website) {
            if (isFieldValid(data.website)) {
              try {
                const decryptedWebsiteArray = await decryptFieldValueWithTwoCiphersCBC(
                  data.website,
                  masterKey,
                  new_iterations
                );
                decryptedWebsite = new TextDecoder().decode(new Uint8Array(decryptedWebsiteArray));
                isWebsiteDecrypted = true;
              } catch (error) {
                console.error("Error decrypting website:", error);
                decryptedWebsite = "Incorrect Ciphertext";
              }
            } else {
              decryptedWebsite = "Incorrect Ciphertext";
            }
          }
          
          // Check integrity only if tag is valid and all fields were successfully decrypted
          if (isTagValid && isTitleDecrypted && isLoginDecrypted && isPasswordDecrypted && isWebsiteDecrypted) {
            // Prepare the plaintext to verify integrity
            const combinedData = new TextEncoder().encode(`${decryptedTitle}+${decryptedLogin}+${decryptedPassword}+${decryptedWebsite}`);
          
            // Verify record integrity
            integrityCheckPassed = await CheckRecordIntegrity(
              data.tag,
              masterKey,
              new_iterations,
              combinedData
            );
          }

          // Create a new login object with the decrypted values and integrity check result
          const newLogin: DecryptedLogin = {
            id: doc.id,
            title: decryptedTitle,
            login: decryptedLogin,
            password: decryptedPassword,
            website: decryptedWebsite,
            integrity: integrityCheckPassed, // Set integrity based on verification result
          };

          // Update state with the new login immediately
          setLogins(prevLogins => [...prevLogins, newLogin]);

          // Add the ID to the processed set
          processedIds.add(doc.id);

        } catch (error) {
          console.error('Error decrypting login data:', error);
          //toast.error(`Error decrypting login data: ${error instanceof Error ? error.message : 'Unknown error'}`);
          createNotification('error', 'Error', `Error decrypting login data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

    } catch (error) {
      console.error('Error fetching logins:', error);
      //toast.error(`Error fetching logins: ${error instanceof Error ? error.message : 'Unknown error'}`);
      createNotification('error', 'Error', `Error fetching logins: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPopupVisible(false); // Ensure popup is hidden after processing all records
    }
  };
  fetchLogins();
};

useEffect(() => {
  extractRecordsFromFirebase();
}, []);


  const showTwoLinedPopup = (messageLine1: string, messageLine2: string) => {
    setIsPopupVisible(false);
    setPopupMessageLine1(messageLine1);
    setPopupMessageLine2(messageLine2);
    setIsPopupVisible(true);
};

  useEffect(() => {
    const checkScrollable = () => {
      if (linesRef.current) {
        setIsScrollable(linesRef.current.scrollHeight > linesRef.current.clientHeight);
      }
    };

    checkScrollable();
    window.addEventListener('resize', checkScrollable);

    return () => window.removeEventListener('resize', checkScrollable);
  }, [logins]);


  useEffect(() => {
    const checkScrollable = () => {
      if (linesRef.current) {
        setIsScrollable(linesRef.current.scrollHeight > linesRef.current.clientHeight);
      }
    };
  
    checkScrollable();
    window.addEventListener('resize', checkScrollable);
  
    return () => window.removeEventListener('resize', checkScrollable);
  }, [logins]);

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

const computeTagForRecordUsingHMACSHA512 = useCallback(async (key: Uint8Array, data: Uint8Array) => {
  const chunkSize = 256 * 1024; // 256 KB chunks
  let offset = 0;
  const hmac = await createHMAC(createSHA512(), key);
  hmac.init();

  while (offset < data.length) {
    const chunk = data.slice(offset, Math.min(offset + chunkSize, data.length));
    hmac.update(chunk);
    offset += chunk.length;

  }

  const signature = hmac.digest('binary');
  return new Uint8Array(signature);
}, []);

const derive224BytesUsingArgon2id = useCallback(async (password: Uint8Array, salt: Uint8Array, iterations: number) => {
  await new Promise(resolve => setTimeout(resolve, 50));
  const derivedKey = await argon2id({
    password,
    salt,
    parallelism: 1,
    iterations,
    memorySize: 512,
    hashLength: 224,
    outputType: 'binary',
  });
  return new Uint8Array(derivedKey);
}, []);

  const encryptRecordTagWithTwoCiphersCBC = async (
    bytes: Uint8Array,
    password: Uint8Array,
    iterations: number,
): Promise<Uint8Array> => {
    const chunkSize = 256 * 1024; // 256 KB chunks
    let offset = 0;
    const salt = window.crypto.getRandomValues(new Uint8Array(32));
    const encryptedChunks: Uint8Array[] = [];
    encryptedChunks.push(salt);
    const derivedKey = await derive224BytesUsingArgon2id(password, salt, iterations);
    let chacha20key = new Uint8Array(derivedKey.slice(0, 64));
    const blockCipherKey = derivedKey.slice(64, 96);
    const hmacKey = derivedKey.slice(96);
    const tag = await computeTagForRecordUsingHMACSHA512(hmacKey, bytes);
    const encryptedData = new Uint8Array(tag.length);
  
    const totalSize = tag.length;
    while (offset < totalSize) {
      const input = Array.from(chacha20key).map(byte => byte.toString(16).padStart(2, '0')).join('');
      const sha512_output = await sha512(input);
      const sha512Array = hexStringToArray(sha512_output);
      const byteArray = new Uint8Array(sha512Array);
      const generatedHash = await whirlpool(byteArray);
      chacha20key = new Uint8Array(hexStringToArray(generatedHash));
  
      const chunk = tag.slice(offset, Math.min(offset + chunkSize, totalSize));
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

const encryptFieldValueWithTwoCiphersCBC = async (
    bytes: Uint8Array,
    password: Uint8Array,
    iterations: number
): Promise<Uint8Array> => {
    const chunkSize = 256 * 1024; // 256 KB chunks
    let offset = 0;
    const salt = window.crypto.getRandomValues(new Uint8Array(32));
    const encryptedChunks: Uint8Array[] = [];
    encryptedChunks.push(salt);
    
    // Derive key from password
    const derivedKey = await derive224BytesUsingArgon2id(password, salt, iterations);
    let chacha20key = new Uint8Array(derivedKey.slice(0, 64));
    const blockCipherKey = derivedKey.slice(64, 96);

    // Prepare for encryption without calculating a tag
    const encryptedData = new Uint8Array(bytes.length);
  
    const totalSize = bytes.length;
  
    while (offset < totalSize) {
        const input = Array.from(chacha20key).map(byte => byte.toString(16).padStart(2, '0')).join('');
        const sha512_output = await sha512(input);
        const sha512Array = hexStringToArray(sha512_output);
        const byteArray = new Uint8Array(sha512Array);
        const generatedHash = await whirlpool(byteArray);
        chacha20key = new Uint8Array(hexStringToArray(generatedHash));
  
        // Encrypt the data directly
        const chunk = bytes.slice(offset, Math.min(offset + chunkSize, totalSize));
        const nonce = chacha20key.slice(32, 40);
        const chacha20 = new ChaCha20();
        const encryptedChunk = chacha20.encrypt(chacha20key.slice(0, 32), chunk, nonce);
  
        for (let i = 0; i < encryptedChunk.length; i++) {
            encryptedData[offset + i] = encryptedChunk[i];
        }
        offset += chunk.length;
    }

    // Block cipher encryption with Serpent
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
  
    // Combine all encrypted chunks into a single result
    const totalLength = encryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    
    let soffset = 0;
    
    for (const chunk of encryptedChunks) {
        result.set(chunk, soffset);
        soffset += chunk.length;
    }
  
    return result;
};

const CheckRecordIntegrity = async (
  input: string, 
  password: Uint8Array, 
  iterations: number,
  plaintextToVerify: Uint8Array
): Promise<boolean> => {
  const chunkSize = 16;

  const bytes = new Uint8Array(input.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  const salt = bytes.slice(0, 32);
  const derivedKey = await derive224BytesUsingArgon2id(password, salt, iterations);
  let chacha20key = new Uint8Array(derivedKey.slice(0, 64));
  const blockCipherKey = derivedKey.slice(64, 96);
  const hmacKey = derivedKey.slice(96);

  const extractedIV = bytes.slice(32, 48);
  const decryptedIV = await decryptSerpent256ECB(extractedIV, blockCipherKey);
  let previousCiphertext = decryptedIV;

  const decryptedData: number[] = [];
  const dataLength = bytes.length;
  for (let i = 48; i < dataLength; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    const decryptedChunk = await decryptSerpent256ECB(chunk, blockCipherKey);
    const xorChunk = decryptedChunk.map((byte, index) => byte ^ previousCiphertext[index]);
    for (let j = 0; j < xorChunk.length; j++) {
      decryptedData.push(xorChunk[j]);
    }
    previousCiphertext = chunk;
  }

  const decryptedDataUint8Array = new Uint8Array(decryptedData);

  const chunkSizeForStreamCipher = 256 * 1024; // 256 KB chunks
  let streamCipherOffset = 0;
  const decryptedChunks = new Uint8Array(decryptedDataUint8Array);
  let decryptedOffset = 0;
  
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
    decryptedChunks.set(decryptedChunk, decryptedOffset);
    decryptedOffset += decryptedChunk.length;
  
    streamCipherOffset += chunk.length;
  }

  const computedTag = await computeTagForRecordUsingHMACSHA512(hmacKey, plaintextToVerify);
  return compareUint8Arrays(decryptedChunks, computedTag);
};

function compareUint8Arrays(array1: Uint8Array, array2: Uint8Array): boolean {
  // Check if the lengths are equal
  if (array1.length !== array2.length) {
    return false;
  }

  // Compare each element in the arrays
  for (let i = 0; i < array1.length; i++) {
    if (array1[i] !== array2[i]) {
      return false; // Return false if any element is different
    }
  }

  return true; // Return true if all elements are equal
}

const decryptFieldValueWithTwoCiphersCBC = async (
  input: string, 
  password: Uint8Array, 
  iterations: number
): Promise<Uint8Array> => {
  const chunkSize = 16;

  const bytes = new Uint8Array(input.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  const salt = bytes.slice(0, 32);
  const derivedKey = await derive224BytesUsingArgon2id(password, salt, iterations);
  let chacha20key = new Uint8Array(derivedKey.slice(0, 64));
  const blockCipherKey = derivedKey.slice(64, 96);

  const extractedIV = bytes.slice(32, 48);
  const decryptedIV = await decryptSerpent256ECB(extractedIV, blockCipherKey);
  let previousCiphertext = decryptedIV;

  const decryptedData: number[] = [];
  const dataLengthNoLC = bytes.length - chunkSize;
  for (let i = 48; i < dataLengthNoLC; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    const decryptedChunk = await decryptSerpent256ECB(chunk, blockCipherKey);
    const xorChunk = decryptedChunk.map((byte, index) => byte ^ previousCiphertext[index]);
    for (let j = 0; j < xorChunk.length; j++) {
      decryptedData.push(xorChunk[j]);
    }
    previousCiphertext = chunk;
  }

  // Handle padding in the last block
  const encryptedLastBlock = bytes.slice(bytes.length - chunkSize);
  const decryptedLastBlock = await decryptSerpent256ECB(encryptedLastBlock, blockCipherKey);
  const decryptedLastBlockXORed = decryptedLastBlock.map((byte, index) => byte ^ previousCiphertext[index]);
  const paddingLength = pkcs7PaddingConsumed(decryptedLastBlockXORed);
  if (paddingLength === 0) {

  } else if (paddingLength === 16) {
    // Do nothing
  } else {
    const unpaddedLastBlock = decryptedLastBlockXORed.slice(0, 16 - paddingLength);
    for (let j = 0; j < unpaddedLastBlock .length; j++) {
      decryptedData.push(unpaddedLastBlock[j]);
    }
  }

  const decryptedDataUint8Array = new Uint8Array(decryptedData);

  const chunkSizeForStreamCipher = 256 * 1024; // 256 KB chunks
  let streamCipherOffset = 0;
  const decryptedChunks = new Uint8Array(decryptedDataUint8Array);
  let decryptedOffset = 0;
  
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
  
    decryptedChunks.set(decryptedChunk, decryptedOffset);
    decryptedOffset += decryptedChunk.length;
  
    streamCipherOffset += chunk.length;
  }
  
  return decryptedChunks;
};

function pkcs7PaddingConsumed(data: Uint8Array) {
  let allTen = true;
  for (let i = 0; i < 16; i++) {
    if (data[i] !== 0x10) {
      allTen = false;
      break;
    }
  }
  if (allTen) {
    return 16;
  }
  const paddingValue = data[15];
  if (paddingValue < 1 || paddingValue > 16) {
    return 0;
  }
  for (let i = 1; i <= paddingValue; i++) {
    if (data[16 - i] !== paddingValue) {
      return 0;
    }
  }
  return paddingValue;
}

  const addRecord = async (newLogin: Omit<DecryptedLogin, 'id' | 'integrity'>) => {
    try{
      if (!auth.currentUser) {
        setShowForm(false);
        showTwoLinedPopup('Authentication Error', 'Oops! It looks like your session has expired. Please refresh the page and try logging in again.');
        await new Promise(() => {});
        throw new Error('User not authenticated');
      }
    }
    catch{

    }
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
    
      // Calculate new iterations based on the provided iterations value
      const new_iterations: number = Math.round(250 + (iterations / 20));

      // Encode the unencrypted fields
      const unencryptedTitle = new TextEncoder().encode(newLogin.title); 
      const unencryptedLogin = new TextEncoder().encode(newLogin.login); 
      const unencryptedPassword = new TextEncoder().encode(newLogin.password); 
      const unencryptedWebsite = new TextEncoder().encode(newLogin.website);
    
      // Encrypt the fields using two ciphers and CBC mode
      const encryptedTitle = await encryptFieldValueWithTwoCiphersCBC(unencryptedTitle, masterKey, new_iterations);
      const encryptedLogin = await encryptFieldValueWithTwoCiphersCBC(unencryptedLogin, masterKey, new_iterations);
      const encryptedPassword = await encryptFieldValueWithTwoCiphersCBC(unencryptedPassword, masterKey, new_iterations);
      const encryptedWebsite = await encryptFieldValueWithTwoCiphersCBC(unencryptedWebsite, masterKey, new_iterations);

      // Create a combined tag for the record
      const combinedData = new TextEncoder().encode(`${newLogin.title}+${newLogin.login}+${newLogin.password}+${newLogin.website}`);
      const encryptedTag = await encryptRecordTagWithTwoCiphersCBC(combinedData, masterKey, new_iterations);
      // Prepare the login data object to be stored in Firestore
      const loginData: EncryptedLogin = {
        title: Array.from(encryptedTitle).map(byte => byte.toString(16).padStart(2, '0')).join(''),
        login: Array.from(encryptedLogin).map(byte => byte.toString(16).padStart(2, '0')).join(''),
        password: Array.from(encryptedPassword).map(byte => byte.toString(16).padStart(2, '0')).join(''),
        website: Array.from(encryptedWebsite).map(byte => byte.toString(16).padStart(2, '0')).join(''),
        tag: Array.from(encryptedTag).map(byte => byte.toString(16).padStart(2, '0')).join(''),
      };
      showTwoLinedPopup("Uploading Record to Firebase", "Please wait for a while");
      // Create a document reference in Firestore
      const docRef = doc(collection(db, `data/${user.email}/private/encrypted/logins`));
      
      // Store the encrypted login data in Firestore
      await setDoc(docRef, loginData);
    
      // Create a decrypted login object with the document ID
      const newLoginWithId: DecryptedLogin = {
        id: docRef.id,
        ...newLogin,
        integrity: true,
      };
      // Update local state with the new login entry
      setLogins(prevLogins => [...prevLogins, newLoginWithId]);
      
      // Show success toast notification
      //toast.success('Login added successfully!');
      createNotification('success', 'Success', 'Login added successfully!');
    } catch (error) {
      console.error('Error adding login:', error);
      
      // Show error toast notification
      //oast.error(`Error adding login: ${error instanceof Error ? error.message : 'Unknown error'}`);
      createNotification('error', 'Error', `Error adding login: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPopupVisible(false); // Hide the popup regardless of success or failure
      setShowForm(false);
    }
  };

  const handleAddRecord = () => {
    setFormMode('add');
    setCurrentRecord(null);
    setShowForm(true);
  };

  const handleRecordClick = (id: string) => {
    const record = logins.find(l => l.id === id);
    setCurrentRecord(record || null);
    setFormMode('view');
    setShowForm(true);
  };

  const handleDelete = async () => {
    setShowConfirmPopUp(false);
    if (!currentRecord) {
      //toast.error('No record selected for deletion');
      createNotification('error', 'Error', 'No record selected for removal.');
      return;
    }
    try{
      if (!auth.currentUser) {
        setShowForm(false);
        showTwoLinedPopup('Authentication Error', 'Oops! It looks like your session has expired. Please refresh the page and try logging in again.');
        await new Promise(() => {});
        throw new Error('User not authenticated');
      }
    }
    catch{

    }
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }
  
      showTwoLinedPopup("Deleting Record from Firebase", "It shouldn't take long");
  
      // Create a document reference in Firestore
      const docRef = doc(db, `data/${user.email}/private/encrypted/logins`, currentRecord.id);
  
      // Delete the document from Firestore
      await deleteDoc(docRef);
  
      // Update local state by removing the deleted login
      setLogins(prevLogins => prevLogins.filter(login => login.id !== currentRecord.id));
  
      // Show success toast notification
      //toast.success('Record deleted successfully!');
      createNotification('success', 'Success', 'Record deleted successfully!');
  
      // Close the form if it's open
      setShowForm(false);
      setCurrentRecord(null);
  
    } catch (error) {
      console.error('Error deleting record:', error);
  
      // Show error toast notification
      //toast.error(`Error deleting record: ${error instanceof Error ? error.message : 'Unknown error'}`);
      createNotification('error', 'Error', `Error deleting record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPopupVisible(false); // Hide the popup regardless of success or failure
    }
  };
  
  const handleCancelDelete = () => {
    setShowConfirmPopUp(false);
  };
 
  const handleDeleteConfirmation = () => {
    setShowConfirmPopUp(true);
  };

  const refreshRecords = async () => {
    while (logins.length > 0) {
      logins.pop();
  }
    showTwoLinedPopup("Fetching your records", "Please wait for a while");

    try {
      const user = auth.currentUser;
      if (!auth.currentUser) {
        setShowForm(false);
        showTwoLinedPopup('Authentication Error', 'Oops! It looks like your session has expired. Please refresh the page and try logging in again.');
        await new Promise(() => {});
        throw new Error('User not authenticated');
      }
      if (!user) throw new Error('User not authenticated');

      const loginsRef = collection(db, `data/${user.email}/private/encrypted/logins`);
      const querySnapshot = await getDocs(loginsRef);
      let fileIndex = 0; // Initialize fileIndex

      // Create a set to track processed IDs
      const processedIds = new Set<string>();

      // Process each document in the query snapshot
      for (const doc of querySnapshot.docs) {
        const data = doc.data() as EncryptedLogin;
        fileIndex++;

        // Show pop-up for decrypting each record
        showTwoLinedPopup(`Decrypting record N${fileIndex}/${querySnapshot.docs.length}`, "Please wait for a while");

        // Check if this ID has already been processed
        if (processedIds.has(doc.id)) {
          console.warn(`Record with ID ${doc.id} has already been processed. Skipping.`);
          continue; // Skip this record if it's already processed
        }

        try {
          const new_iterations: number = Math.round(250 + (iterations / 20));

          let integrityCheckPassed = false;

          // Check if tag is valid
          const isTagValid = data.tag && typeof data.tag === 'string' && data.tag.length === 224 && /^[0-9A-Fa-f]+$/.test(data.tag);
          
          // Function to check if a field is valid
          const isFieldValid = (field: string | undefined): boolean => {
            return field !== undefined &&
                   typeof field === 'string' &&
                   field.length >= 128 &&
                   field.length % 32 === 0 &&
                   /^[0-9A-Fa-f]+$/.test(field);
          };
          
          let decryptedTitle = "Missing Ciphertext";
          let decryptedLogin = "Missing Ciphertext";
          let decryptedPassword = "Missing Ciphertext";
          let decryptedWebsite = "Missing Ciphertext";
          
          let isTitleDecrypted = false;
          let isLoginDecrypted = false;
          let isPasswordDecrypted = false;
          let isWebsiteDecrypted = false;
          
          // Decrypt fields only if they are present and valid
          if (data.title) {
            if (isFieldValid(data.title)) {
              try {
                const decryptedTitleArray = await decryptFieldValueWithTwoCiphersCBC(
                  data.title,
                  masterKey,
                  new_iterations
                );
                decryptedTitle = new TextDecoder().decode(new Uint8Array(decryptedTitleArray));
                isTitleDecrypted = true;
              } catch (error) {
                console.error("Error decrypting title:", error);
                decryptedTitle = "Incorrect Ciphertext";
              }
            } else {
              decryptedTitle = "Incorrect Ciphertext";
            }
          }
          
          if (data.login) {
            if (isFieldValid(data.login)) {
              try {
                const decryptedLoginArray = await decryptFieldValueWithTwoCiphersCBC(
                  data.login,
                  masterKey,
                  new_iterations
                );
                decryptedLogin = new TextDecoder().decode(new Uint8Array(decryptedLoginArray));
                isLoginDecrypted = true;
              } catch (error) {
                console.error("Error decrypting login:", error);
                decryptedLogin = "Incorrect Ciphertext";
              }
            } else {
              decryptedLogin = "Incorrect Ciphertext";
            }
          }
          
          if (data.password) {
            if (isFieldValid(data.password)) {
              try {
                const decryptedPasswordArray = await decryptFieldValueWithTwoCiphersCBC(
                  data.password,
                  masterKey,
                  new_iterations
                );
                decryptedPassword = new TextDecoder().decode(new Uint8Array(decryptedPasswordArray));
                isPasswordDecrypted = true;
              } catch (error) {
                console.error("Error decrypting password:", error);
                decryptedPassword = "Incorrect Ciphertext";
              }
            } else {
              decryptedPassword = "Incorrect Ciphertext";
            }
          }
          
          if (data.website) {
            if (isFieldValid(data.website)) {
              try {
                const decryptedWebsiteArray = await decryptFieldValueWithTwoCiphersCBC(
                  data.website,
                  masterKey,
                  new_iterations
                );
                decryptedWebsite = new TextDecoder().decode(new Uint8Array(decryptedWebsiteArray));
                isWebsiteDecrypted = true;
              } catch (error) {
                console.error("Error decrypting website:", error);
                decryptedWebsite = "Incorrect Ciphertext";
              }
            } else {
              decryptedWebsite = "Incorrect Ciphertext";
            }
          }
          
          // Check integrity only if tag is valid and all fields were successfully decrypted
          if (isTagValid && isTitleDecrypted && isLoginDecrypted && isPasswordDecrypted && isWebsiteDecrypted) {
            // Prepare the plaintext to verify integrity
            const combinedData = new TextEncoder().encode(`${decryptedTitle}+${decryptedLogin}+${decryptedPassword}+${decryptedWebsite}`);
          
            // Verify record integrity
            integrityCheckPassed = await CheckRecordIntegrity(
              data.tag,
              masterKey,
              new_iterations,
              combinedData
            );
          }

          // Create a new login object with the decrypted values and integrity check result
          const newLogin: DecryptedLogin = {
            id: doc.id,
            title: decryptedTitle,
            login: decryptedLogin,
            password: decryptedPassword,
            website: decryptedWebsite,
            integrity: integrityCheckPassed, // Set integrity based on verification result
          };

          // Update state with the new login immediately
          setLogins(prevLogins => [...prevLogins, newLogin]);

          // Add the ID to the processed set
          processedIds.add(doc.id);

        } catch (error) {
          console.error('Error decrypting login data:', error);
          //toast.error(`Error decrypting login data: ${error instanceof Error ? error.message : 'Unknown error'}`);
          createNotification('error', 'Error', `Error decrypting login data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

    } catch (error) {
      console.error('Error fetching logins:', error);
      //toast.error(`Error fetching logins: ${error instanceof Error ? error.message : 'Unknown error'}`);
      createNotification('error', 'Error', `Error fetching logins: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPopupVisible(false); // Ensure popup is hidden after processing all records
    }
  };
 

  return (
    <div className="encrypted-space">
      <main className="encrypted-space-main">
        <div className="encrypted-space-paper">
          <div className="encrypted-space-line-or-scroll"></div>
          <div className="encrypted-space-holes">
            <div className="encrypted-space-hole"></div>
            <div className="encrypted-space-hole"></div>
            <div className="encrypted-space-hole"></div>
          </div>
          <div className={`encrypted-space-lines ${isScrollable ? 'scrollable' : ''}`} ref={linesRef}>
            <div className="encrypted-space-user">{`${username}'s stuff`}</div>
            <div className="encrypted-space-add-record" onClick={handleAddRecord}>
              Click here to add a new record.
            </div>
            {logins.map((login) => (
              <div
                key={login.id}
                className="encrypted-space-record"
                onClick={() => handleRecordClick(login.id)}
                style={!login.integrity ? { color: 'red', textDecoration: 'line-through' } : {}}
              >
                {login.title.length > 26 ? `${login.title.substring(0, 25)}...` : login.title}
              </div>
            ))}
            <div style={{ height: '50px', lineHeight: '50px', userSelect: 'none', WebkitUserSelect: 'none', msUserSelect: 'none', cursor: 'default' }}>&nbsp;</div>
            <div className="encrypted-space-record" onClick={refreshRecords}>
              Refresh
            </div>
          </div>

          {/* Confirmation Pop-Up */}
          {showConfirmPopUp && (
                <div 
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 'auto',
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1.6rem 3rem',
                  border: '3px solid var(--password-vault-foreground-color)',
                  color: 'black',
                  zIndex: 1101,
                  fontFamily: '"Questrial", sans-serif',
                  backgroundColor: '#ffec63',
                  backgroundImage: `
                    linear-gradient(45deg, #ffd966 25%, transparent 25%, transparent 75%, #ffd966 75%, #ffd966),
                    linear-gradient(-45deg, #ffd966 25%, transparent 25%, transparent 75%, #ffd966 75%, #ffd966)
                  `,
                  backgroundSize: '60px 60px',
                  backgroundPosition: '0 0',
                  animation: 'slide 4s infinite linear',
                  textAlign: 'center',
                }}
              >
              <p className="encrypted-space-confirm-pop-up-message">Are you sure you want to delete this record?</p>
              <div className="encrypted-space-confirm-pop-up-options">
                <button className="encrypted-space-confirm-pop-up-btn" onClick={handleDelete}>
                  Yes
                </button>
                <button className="encrypted-space-confirm-pop-up-btn" onClick={handleCancelDelete}>
                  No
                </button>
              </div>
            </div>
          )}
          {isPopupVisible && (
            <div className="pop-up-login-container-overlay">
              <div
                  id="file-processing-popup"
                  className="pop-up-login-container"
                  style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '80%',
                    maxWidth: '600px',
                    background: 'transparent',
                    borderRadius: '10px',
                    zIndex: 1000,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                <div className="pop-up-login-container-main">
                  <div className="pop-up-login-container-content">
                    <p className="pop-up-login-container-message-text">{popupMessageLine1}</p>
                    <p className="pop-up-login-container-message-text">{popupMessageLine2}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Form Pop-Up */}
          {showForm && (
            <div className="encrypted-space-pop-up-form-wrapper">
              <div className="encrypted-space-pop-up-form">
                <div 
                  className="encrypted-space-pop-up-form-face"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div className="encrypted-space-pop-up-form-content">
                    <h2>{formMode === 'add' ? 'New Record' : 'View Record'}</h2>
                    {/* Form Fields */}
                    <div className="encrypted-space-pop-up-form-field-wrapper">
                      <input type="text" name="title" placeholder="Title" defaultValue={currentRecord?.title} readOnly={formMode === 'view'} required />
                      <label>Title</label>
                    </div>
                    <div className="encrypted-space-pop-up-form-field-wrapper">
                      <input type="text" name="username" placeholder="Username" defaultValue={currentRecord?.login} readOnly={formMode === 'view'} required />
                      <label>Username</label>
                    </div>
                    <div className="encrypted-space-pop-up-form-field-wrapper">
                      <input type="text" name="password" placeholder="Password" defaultValue={currentRecord?.password} readOnly={formMode === 'view'} required />
                      <label>Password</label>
                    </div>
                    <div className="encrypted-space-pop-up-form-field-wrapper">
                      <input type="text" name="website" placeholder="Website" defaultValue={currentRecord?.website} readOnly={formMode === 'view'} required />
                      <label>Website</label>
                    </div>

                    {/* Buttons */}
                    <div className={`encrypted-space-pop-up-form-buttons`}>
                      {formMode === 'add' ? (
                        <>
                          <FishyButton type="button" className={`button--2`} onClick={async () => {
                            // Extract values directly from input fields
                            const title = (document.querySelector('input[name="title"]') as HTMLInputElement).value;
                            const username = (document.querySelector('input[name="username"]') as HTMLInputElement).value;
                            const password = (document.querySelector('input[name="password"]') as HTMLInputElement).value;
                            const website = (document.querySelector('input[name="website"]') as HTMLInputElement).value;

                            // Check for empty fields
                            if (!title || !username || !password || !website) {
                              /*
                              toast.info("Please fill in all fields.", {
                                position: "top-right",
                                autoClose: 3000,
                                closeOnClick: true,
                                pauseOnHover: true,
                                draggable: true,
                                progress: undefined,
                                theme: "light",
                            });
                            */
                            createNotification('warning', 'Warning', 'Please fill in all fields.');
                    
                              return; // Exit if any field is empty
                            }

                            showTwoLinedPopup("Encrypting Record", "Please wait for a while");

                            await new Promise(resolve => setTimeout(resolve, 100));
                            
                            try {
                              // Create new login object
                              const newLogin = { title, login: username, password, website };
                              await addRecord(newLogin); // Assuming addRecord is defined elsewhere

                            } catch (error) {
                              console.error("Error adding record:", error);
                            }
                          }}>
                            Add
                          </FishyButton>
                          <FishyButton type="button" className={`button--3`} onClick={() => setShowForm(false)}>
                            Cancel
                          </FishyButton>
                        </>
                      ) : (
                        <>
                          {/* OK button and Delete button */}
                          <FishyButton type="button" className={`button--2`} onClick={() => setShowForm(false)}>
                            OK
                          </FishyButton>
                          <FishyButton type="button" className={`button--1`} onClick={handleDeleteConfirmation}>
                            Delete
                          </FishyButton>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Embedded Styles for All Components */}
        {/* Add all your CSS styles here */}
        {/* Example styles for the component */}
        <style jsx>{`
          @import url("https://fonts.googleapis.com/css?family=Roboto:400,400i,700");
          @import url("https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap");
          @import url("https://fonts.googleapis.com/css2?family=Poppins&display=swap");

          .pop-up-login-container-overlay {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              z-index: 2000; /* Ensure it's above everything */
          }

          .pop-up-login-container-main {
              width: 456px;
              padding: 20px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              align-items: center;
              background: rgba(26, 32, 48, 0.7);
              backdrop-filter: blur(10px) saturate(90%);
              border-radius: 10px;
              border: 1px solid rgba(255, 255, 255, 0.18);
          }

          .pop-up-login-container-content {
              transform: translateZ(60px);
              width: 100%;
          }

          .pop-up-login-container-message-text {
              font-size: 1.2em;
              font-weight: bold;
              color: #eeeeee;
              margin: 10px 0;
              text-align: center;
              word-wrap: break-word;
              white-space: pre-wrap;
          }

          h1 {
              font-weight: bold;
              margin: 0;
          }

          .h1-20px-bottom {
              margin-bottom: 20px;
          }

          h2 {
              text-align: center;
          }

          p {
              letter-spacing: 0.5px;
              margin: 20px 0 20px;
          }

          span {
              font-size: 12px;
          }

          a {
              color: #1890ff; /* Ant Design blue */
              font-size: 14px;
              text-decoration: none;
              margin: 15px 0;
          }


          input {
            border: none;
            padding: 12px 15px;
            margin: 8px 0;
            width: 100%;
            border-radius: 5px;
          }

          .encrypted-space {
            min-height: 100vh;
            width: 100%;
            background: rgba(26, 32, 48, 0.8);
            backdrop-filter: blur(12px) saturate(90%);
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
          }

          .encrypted-space-main {
            width: calc(100%);
            height: calc(100vh - 72px);
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 24px 50px;
          }

          .encrypted-space-paper {
            font-family: "Patrick Hand", cursive;
            position: relative;
            background-color: var(--password-vault-background-color);
            box-shadow: 0px 0px 3px 1px rgba(0, 0, 0, 0.2);
            width: 100%;
            height: 100%;
            min-width: 425px;
            min-height: 550px;
            aspect-ratio: 425 / 550;
            display: flex;
            overflow: hidden;
          }

          .encrypted-space-lines {
            position: relative;
            height: 100%;
            width: calc(100% - 10px);
            padding: 50px 16px 50px 116px;
            box-sizing: border-box;
            background-image: repeating-linear-gradient(
              var(--password-vault-background-color) 0px,
              var(--password-vault-background-color) 48px, /* Adjust this value based on your line height */
              steelblue 50px
            );
            overflow-y: auto;
            overflow-x: hidden;
            scroll-snap-type: y mandatory;
            overscroll-behavior-y: contain;

            /* Add this property to ensure scrolling starts from the top */
            scroll-padding-top: 0; 
          }

          .encrypted-space-line-or-scroll {
            position: absolute;
            top: 0;
            left: 98px;
            width: 5px;
            height: 100%;
            background: var(--password-vault-line-color);
            transition: background 10s ease-in-out; 
            z-index: 2;
          }

          .encrypted-space-line-or-scroll:hover {
            background: #19647E;
          }

          .encrypted-space-lines.scrollable + .encrypted-space-line-or-scroll {
            background-size: 10px 40px;
            animation: moveBackground alternate linear;
            animation-timeline: --listTimeline;
          }

          @keyframes moveBackground {
            0% {
              background-position: 0 0;
            }
            100% {
              background-position: 0 calc(var(--password-vault-container-height) / -1);
            }
          }

          .encrypted-space-user,
          .encrypted-space-add-record,
          .encrypted-space-record,
          .encrypted-space-next-page {
            height: 50px; /* Ensure this matches your line height */
            line-height: 50px; /* This should also match your line height */
            font-size: 32px;
            color: var(--password-vault-foreground-color);
            margin: 0;
            padding: 0;
            text-align: left;
            
            /* This ensures each item snaps at the start */
            scroll-snap-align: start; 
          }

          .encrypted-space-user,
          .encrypted-space-add-record {
            margin-bottom: 50px;
          }

          .encrypted-space-add-record,
          .encrypted-space-record,
          .encrypted-space-next-page {
            cursor: pointer;
            transition: all 0.3s ease;
          }

          .encrypted-space-add-record:hover,
          .encrypted-space-record:hover,
          .encrypted-space-next-page:hover {
            text-decoration: underline;
            transform: translateY(-2px);
          }

          .encrypted-space-holes {
            position: absolute;
            z-index: 1;
            height: 100%;
            width: 96px;
            top: 0;
            left: 0;
          }

          .encrypted-space-hole {
            position: absolute;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: gainsboro;
            left: 25px;
            box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.1) inset;
          }

          .encrypted-space-hole:nth-child(1) {
            top: 10%;
          }

          .encrypted-space-hole:nth-child(2) {
            top: 50%;
          }

          .encrypted-space-hole:nth-child(3) {
            bottom: 10%;
          }

          /* WebKit Browsers (Chrome, Safari) */
          .encrypted-space-lines::-webkit-scrollbar {
            width: 10px; /* Width of the scrollbar */
          }

          /* Track */
          .encrypted-space-lines::-webkit-scrollbar-track {
            background: #f1f1f1; /* Background of the track */
          }

          /* Handle */
          .encrypted-space-lines::-webkit-scrollbar-thumb {
            background: var(--password-vault-scroller-handle-color); /* Color of the scrollbar handle */
            border-radius: 10px; /* Rounded corners for the handle */
          }

          /* Handle on hover */
          .encrypted-space-lines::-webkit-scrollbar-thumb:hover {
            background: #19647e; /* Color of the handle on hover */
          }

          /* Firefox Styles */
          .encrypted-space-lines {
            scrollbar-width: thin; /* Use 'thin' for a narrower scrollbar */
            scrollbar-color: var(--password-vault-scroller-handle-color) #f1f1f1; /* Handle color and track color */
          }

          @media (max-aspect-ratio: 425/550) {
            .encrypted-space-paper {
              width: 100%;
              height: auto;
            }
          }

          @media (min-aspect-ratio: 425/550) {
            .encrypted-space-paper {
              width: auto;
              height: 100%;
            }
          }

          @media only screen and (max-width: 600px) {
            .encrypted-space-paper {
              transform: scale(0.8);
            }
          }

          @media only screen and (max-width: 450px) {
            .encrypted-space-paper {
              transform: scale(0.7);
            }
          }

          @media only screen and (max-height: 600px) {
            .encrypted-space-paper {
              transform: scale(0.6);
            }
          }

          @media only screen and (max-height: 450px) {
            .encrypted-space-paper {
              transform: scale(0.5);
            }
          }

          .encrypted-space-pop-up-form-wrapper {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.3);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            font-family: Tahoma, Verdana, Segoe, sans-serif;
            font-size: 14px;
          }

          .encrypted-space-pop-up-form {
            width: 360px;
            height: 540px;
            perspective: 600px;
            text-align: left;
          }

          .encrypted-space-pop-up-form-face {
            position: relative;
            width: 100%;
            height: 100%;
            padding: 20px;
            background: var(--password-vault-background-color);
            border: 3px solid var(--password-vault-line-color);
            display: flex;
            flex-direction: column;
          }

          .encrypted-space-pop-up-form-content {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
          }

          .encrypted-space-pop-up-form-content h2 {
            font-size: 1.2em;
            color: var(--password-vault-line-color);
            margin-bottom: 10px;
            font-size: 30px;
          }

          .encrypted-space-pop-up-form-content form {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
          }

          .encrypted-space-pop-up-form-field-wrapper {
            margin-top: 20px;
            position: relative;
          }

          .encrypted-space-pop-up-form-field-wrapper label {
            position: absolute;
            pointer-events: none;
            font-size: 0.85em;
            top: 40%;
            left: 0;
            font-size: 15px;
            transform: translateY(-50%);
            transition: all ease-in 0.25s;
            color: #999;
          }

          .encrypted-space-pop-up-form-field-wrapper input[type="text"],
          .encrypted-space-pop-up-form-field-wrapper input[type="password"],
          .encrypted-space-pop-up-form-field-wrapper textarea {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            border: none;
            background: transparent;
            line-height: 25px;
            font-size: 18px;
            border-bottom: 1px solid var(--password-vault-line-color);
            color: var(--password-vault-foreground-color);
          }

          .encrypted-space-pop-up-form-field-wrapper input[type="text"]:focus,
          .encrypted-space-pop-up-form-field-wrapper input[type="password"]:focus,
          .encrypted-space-pop-up-form-field-wrapper textarea:focus {
            outline: none;
          }

          .encrypted-space-pop-up-form-field-wrapper input[type="text"]::-webkit-input-placeholder,
          .encrypted-space-pop-up-form-field-wrapper input[type="password"]::-webkit-input-placeholder,
          .encrypted-space-pop-up-form-field-wrapper textarea::-webkit-input-placeholder {
            opacity: 0;
          }

          .encrypted-space-pop-up-form-field-wrapper input[type="text"]::-moz-placeholder,
          .encrypted-space-pop-up-form-field-wrapper input[type="password"]::-moz-placeholder,
          .encrypted-space-pop-up-form-field-wrapper textarea::-moz-placeholder {
            opacity: 0;
          }

          .encrypted-space-pop-up-form-field-wrapper input[type="text"]:-ms-input-placeholder,
          .encrypted-space-pop-up-form-field-wrapper input[type="password"]:-ms-input-placeholder,
          .encrypted-space-pop-up-form-field-wrapper textarea:-ms-input-placeholder {
            opacity: 0;
          }

          .encrypted-space-pop-up-form-field-wrapper input[type="text"]:-moz-placeholder,
          .encrypted-space-pop-up-form-field-wrapper input[type="password"]:-moz-placeholder,
          .encrypted-space-pop-up-form-field-wrapper textarea:-moz-placeholder {
            opacity: 0;
          }

          .encrypted-space-pop-up-form-field-wrapper input[type="text"]:focus + label,
          .encrypted-space-pop-up-form-field-wrapper input[type="text"]:not(:placeholder-shown) + label,
          .encrypted-space-pop-up-form-field-wrapper input[type="password"]:focus + label,
          .encrypted-space-pop-up-form-field-wrapper input[type="password"]:not(:placeholder-shown) + label,
          .encrypted-space-pop-up-form-field-wrapper textarea:focus + label,
          .encrypted-space-pop-up-form-field-wrapper textarea:not(:placeholder-shown) + label {
            top: -1%;
            color: var(--password-vault-line-color);
          }

          .encrypted-space-pop-up-form-field-wrapper textarea {
            resize: none;
            line-height: 1em;
          }

          .encrypted-space-pop-up-form-field-wrapper textarea:focus + label,
          .encrypted-space-pop-up-form-field-wrapper textarea:not(:placeholder-shown) + label {
            top: -25%;
          }

          .encrypted-space-pop-up-form-buttons {
            display: flex;
            justify-content: space-between;
            margin-top: auto;
          }

          @keyframes slide {
            from { background-position: 0 0; }
            to { background-position: -120px 60px; }
          }

          .encrypted-space-confirm-pop-up-message {
            font-size: 19px;
            margin-bottom: 20px;
          }

          .encrypted-space-confirm-pop-up-btn {
            color: inherit;
            font-family: inherit;
            font-size: inherit;
            background-color:white;
            width: 70px;
            padding: 10px; /* Adjusted padding */
            border-radius: 4px; /* Rounded corners */
            border:none; /* No border */
            margin-right:.5rem; /* Space between buttons */
            box-shadow:.2rem .2rem .5rem rgba(0,0,0,.2); /* Shadow effect */
            transition:.2s; /* Smooth transition */
          }

          .encrypted-space-confirm-pop-up-btn:hover {
            box-shadow:.4rem .4rem .5rem rgba(0,0,0,.3); /* Darker shadow on hover */
            transform:translate(-.2rem,-.2rem); /* Move slightly up */
          }

          .encrypted-space-confirm-pop-up-options {
            display:flex; /* Flexbox for button alignment */
            flex-direction:row; /* Horizontal layout */
            justify-content:center; /* Center buttons */
          }
         `}</style>

      </main>

      {/* Toast Notifications */}
      <div ref={notificationContainerRef} className={styles.notificationContainer}></div>
    </div>  
  );
}
