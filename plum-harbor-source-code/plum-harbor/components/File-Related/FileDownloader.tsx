'use client'

import { useEffect, useImperativeHandle, forwardRef, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'next-i18next';
import Swal from 'sweetalert2';
import { createSHA512, createHMAC, whirlpool, argon2id, sha512 } from 'hash-wasm';
import { ChaCha20 } from 'mipher';
import { decryptSerpent256ECB } from '@/app/cryptographicPrimitives/serpent';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, getDocs, collection, getFirestore } from "firebase/firestore";
import FileDownloadComponent from '@/components/File-Related/FileDownloadComponent';

interface Container {
  id: string;
  title: string;
  color: string;
  fileSize: string;
  description: string;
  metadataIntegrity: boolean;
}

interface ContainerHelper {
  id: string;
  titleIntegrity: boolean;
  titlePaddingValidity: boolean;
  decryptedDescriptionIntegrity: boolean;
  decryptedDescriptionPaddingValidity: boolean;
  encryptedTag: string;
  encryptedLength: number;
}

interface FileDownloaderProps {
  fileTagForDownloader: string;
  onComplete: () => void;
}

interface FileType {
  color:string;
  type:string;
  extensions:string[];
}

const FileDownloader = forwardRef((props: FileDownloaderProps, ref) => {
  const { fileTagForDownloader, onComplete } = props;
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const lastProcessedTagRef = useRef<string | null>(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [popupData, setPopupData] = useState<{
    container: Container;
    messages: string[];
    fileUrl: string | null;
  } | null>(null);

  const fileTypeClassification : FileType[] = [
    { color:'#2B579A', type:'Word Processing Document', extensions:['.doc', '.docx', '.docm', '.dot', '.dotx', '.dotm']},
    { color:'#2196F3', type:'Image', extensions:['.jpg', '.jpeg', '.jfif', '.pjpeg', '.pjp', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp', '.heif', '.heic', '.avif', '.eps']},
    { color:'#227447', type:'Spreadsheet', extensions:['.xls', '.xlsx', '.xlsm', '.xlsb', '.xlt', '.xltx', '.xltm', '.xla', '.xlam', '.xlw']},
    { color:'#A031EB', type:'Archive', extensions:['.zip','.rar','.7z','.tar','.gz','.bz2','.xz','.tar.gz','.tar.bz2','.tar.xz','.arc','.arj','.ace','.cab','.lz','.lzh']},
    { color:'#4332A2', type:'Binary File', extensions:['.bin']},
    { color:'#9525A5', type:'Java File', extensions:['.java','.class','.jar']},
    { color:'#FF5613', type:'Plaintext/Rich Text File ', extensions:['.txt','.rtf']},
    { color:'#D71064', type:'Presentation File ', extensions:['.ppt','.pptx','.pptm','.pps','.ppsx','.pot','.potx','.potm','.odp']},
    { color:'#D31A35', type:'PDF File ', extensions:['.pdf']},
    { color:'#E7013F', type:'Hypertext File ', extensions:['.html','.htm','.xhtml']},
    { color:'#FEEA00', type:'JavaScript File ', extensions:['.js','.mjs','.cjs','.jsx','.es6','.es']},
    { color:'#FF8C01', type:'TypeScript File ', extensions:['.ts','.tsx','.d.ts','.mts','.cts']},
    { color:'#29BF12', type:'Cascading Style Sheets ', extensions:['.css']},
    { color:'#06BE66', type:'Video File ', extensions:['.mp4','.mov','.wmv','.avi','.flv','.f4v','.mkv','.webm','.ogv','.ogg','.3gp','.m4v']},
    { color:'#41C3AA', type:'Audio File ', extensions:['.mp3','.wav','.aiff','.aac','.flac','.ogg','.m4a','.wma','.amr','.ape','.au','.ra','.rm']},
    { color:'#3D4785', type:'Unknown/Other', extensions:['']}
  ];

  const base64ToUint8Array = (base64: string): Uint8Array => {
    try {
      const binaryString = atob(base64);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      return uint8Array;
    } catch (error) {
      console.warn(error);
      return new Uint8Array([1]);
    }
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

const deriveBytesUsingArgon2id = useCallback(async (password: Uint8Array, salt: Uint8Array, iterations: number, number_of_bytes: number) => {
  const derivedKey = await argon2id({
    password,
    salt,
    parallelism: 1,
    iterations,
    memorySize: 512,
    hashLength: number_of_bytes,
    outputType: 'binary',
  });
  return new Uint8Array(derivedKey);
}, []);

const decryptStringWithTwoCiphersCBC = async (
  bytes: Uint8Array, 
  password: Uint8Array, 
  iterations: number
): Promise<[Uint8Array, boolean, boolean]> => {
  const chunkSize = 16;
  const salt = bytes.slice(0, 32);
  const derivedKey = await deriveBytesUsingArgon2id(password, salt, iterations, 224);
  let chacha20key = new Uint8Array(derivedKey.slice(0, 64));
  const blockCipherKey = derivedKey.slice(64, 96);
  const hmacKey = derivedKey.slice(96);

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
  let paddingValid = true;
  if (paddingLength === 0) {
    paddingValid = false;
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
  const newTag = await computeTagForRecordUsingHMACSHA512(hmacKey, decryptedWithStreamCipher);
  let integrityPassed = true;
  for (let i = 0; i < 64; i++) {
    if (decryptedTag[i] !== newTag[i]) {
      integrityPassed = false;
      break;
    }
  }
  
  return [decryptedWithStreamCipher, integrityPassed, paddingValid];
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

  const generateFileSizeString = (size: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(2)} ${units[i]}`;
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

  const downloadError = async() =>{
    const warningMessage = `
      <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('failed-to-download-file')}</p>
      <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('something_went_wrong_line1')}</p>
      <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('check_the_console')}</p>
    `;
    
    Swal.fire({
      icon: "error",
      title: t('error_inscription'), // Set title to 'Warning'
      html: warningMessage, // Use the formatted warning message
      width: 600,
      padding: "3em",
      color: "var(--foreground)",
      background: "var(--background)",
      confirmButtonText: t('ok_button'),
      confirmButtonColor: "var(--firstThemeColor)"
    }).then((result) => {
      if (result.isConfirmed) {
        onComplete();
      }
    });
    return;
  }

  const onDownload = async (container: Container, containerHelper: ContainerHelper, userEmail: string, fileKey: Uint8Array) => {
    try {
  
      //console.log(`Starting download for container: ${container.id}`);
  
      const encryptedLength = containerHelper.encryptedLength;
      if (typeof encryptedLength !== 'number' || encryptedLength <= 0) {
        //console.error('Invalid encryptedLength value');
        const db = getFirestore();
        
        const processingMessage = `
        <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('broken-metadata-detected')}</p>
        <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('attempting-to-download-all-chunks-at-once-as-a-collection')}</p>
        <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please-be-patient-this-can-take-a-while')}</p>
        `; 
        Swal.update({ 
            html: processingMessage,
            showConfirmButton: false,
        });  
        Swal.showLoading();
      
        // Reference to the collection
        const collectionRef = collection(db, `data/${userEmail}/public/files/${container.id}`);
        
        // Fetch all documents in the collection
        const querySnapshot = await getDocs(collectionRef);
        
        const chunks: Uint8Array[] = [];
        
        // Process each document in the collection
        querySnapshot.forEach(doc => {
          const chunkData = doc.data();
          if (chunkData && 'data' in chunkData) {
            const base64String = chunkData.data as string;
            const uint8Array = base64ToUint8Array(base64String);
            
            if (uint8Array.length > 1 && uint8Array.length % 16 === 0) {
              chunks.push(uint8Array);
            } else {
              console.error(`Invalid data in the chunk N${doc.id}`);
              // Handle the error appropriately, maybe skip this chunk or throw an exception
              downloadError();
            }
          } else {
            console.error(`Chunk ${doc.id} is missing data`);
            downloadError();
          }
        });
      
        // Combine all chunks into a single array
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combinedArray = new Uint8Array(totalLength);
        let offset = 0;
      
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          combinedArray.set(chunk, offset);
          offset += chunk.length;
        }
        await decryptFileWithTwoCiphersCBC(combinedArray, fileKey, 100, container, containerHelper);
      }
      else{
        const db = getFirestore();
        let processingMessage = `
        <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('downloading-file')}</p>
        <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>
        `;
        
        // Updating SweetAlert with the new message
        Swal.update({ 
            title: container.title,
            html: processingMessage,
            showConfirmButton: false, // Ensure the confirm button remains hidden
        });

        //console.log(`Encrypted length retrieved: ${encryptedLength}`);
        const chunkSize = 16 * 1024;
        const totalChunks = Math.ceil(encryptedLength / chunkSize);
        //console.log(`Calculated number of chunks: ${totalChunks}`);
    
        const chunks: Uint8Array[] = [];
        let downloadedChunks = 0;
        let chunkNumber = 0;
    
        while (chunkNumber < totalChunks) {
          const chunkRef = doc(db, `data/${userEmail}/public/files/${container.id}`, `${chunkNumber}`);
          const chunkDoc = await getDoc(chunkRef);
    
          if (!chunkDoc.exists()) {
            //console.log(`No more chunks found after ${downloadedChunks} chunks.`);
            break;
          }
    
          const chunkData = chunkDoc.data();
          if (chunkData && 'data' in chunkData) {
            const base64String = chunkData.data as string;
            //console.log(`Processing chunk ${chunkNumber} (Firebase doc: ${chunkDoc.ref.path})`);
            
            const uint8Array = base64ToUint8Array(base64String);
            
            if (uint8Array.length > 1 && uint8Array.length % 16 === 0) {
                chunks.push(uint8Array);
            } else {
                console.error(`Invalid data in the chunk N${downloadedChunks}`);
                // Handle the error appropriately, maybe throw an exception or skip this chunk
                downloadError();
            }
            downloadedChunks++;
    
            const progress = (downloadedChunks / totalChunks) * 100;
            processingMessage = `
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('downloading-file')}</p>
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">
                ${t('progress')}: ${progress.toFixed(2)}%
            </p>
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>
            `;
            
            // Updating SweetAlert with the new message
            Swal.update({ 
                html: processingMessage,
                showConfirmButton: false, // Ensure the confirm button remains hidden
            });
    
            //console.log(`Downloaded chunk ${chunkNumber}: ${uint8Array.length} bytes`);
            //console.log(`Download progress: ${progress.toFixed(2)}% (${downloadedChunks} chunks retrieved)`);
          } else {
            console.error(`Chunk ${chunkNumber} is missing data`);
            downloadError();
          }
          chunkNumber++;
        }
    
        //console.log('Combining chunks...');
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combinedArray = new Uint8Array(totalLength);
        let offset = 0;
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          combinedArray.set(chunk, offset);
          offset += chunk.length;
          //console.log(`Set chunk ${i} at offset ${offset - chunk.length}, length: ${chunk.length}`);
        }
    
        //console.log(`Download completed. Total size: ${combinedArray.length} bytes`);
    
        await decryptFileWithTwoCiphersCBC(combinedArray, fileKey, 100, container, containerHelper);
    }
    } catch (error) {
      
      console.error('Error downloading the "', container.title, '" file from the firebase:', error); // Log the error to the console

      const warningMessage = `
        <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('failed-to-download-file')}</p>
        <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('something_went_wrong_line1')}</p>
        <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('check_the_console')}</p>
      `;
      
      Swal.fire({
        icon: "error",
        title: t('error_inscription'), // Set title to 'Warning'
        html: warningMessage, // Use the formatted warning message
        width: 600,
        padding: "3em",
        color: "var(--foreground)",
        background: "var(--background)",
        confirmButtonText: t('ok_button'),
        confirmButtonColor: "var(--firstThemeColor)"
      });
    }
  };

  const decryptFileWithTwoCiphersCBC = async (
    bytes: Uint8Array,
    password: Uint8Array,
    iterations: number,
    container: Container,
    containerHelper: ContainerHelper
  ): Promise<void> => {
    let processingMessage = `
    <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('preparing-for-file-decryption')}</p>
    <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>
    `;
    
    // Updating SweetAlert with the new message
    Swal.update({ 
        html: processingMessage,
        showConfirmButton: false, // Ensure the confirm button remains hidden
    });
    Swal.showLoading();
    const chunkSize = 16;
    const salt = bytes.slice(0, 32);
    const derivedKey = await deriveBytesUsingArgon2id(password, salt, iterations, 416);
    let chacha20key = new Uint8Array(derivedKey.slice(0, 64));
    const blockCipherKey = derivedKey.slice(64, 96);
    const hmacKey = derivedKey.slice(96, 224);
  
    const extractedIV = bytes.slice(32, 48);
    const decryptedIV = await decryptSerpent256ECB(extractedIV, blockCipherKey);
    //setProcessingStep('Step 1/2 - Decrypting file with Serpent-256 CBC');
    //setProcessingStepDescription('Please wait for a while');
    let previousCiphertext = decryptedIV;
  
    const updateProgressWithDelayForSerpent = async (progress: number): Promise<void> => {
      processingMessage = `
      <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('decryption-step1')}</p>
      <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">
          ${t('progress')}: ${progress.toFixed(2)}%
      </p>
      <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>
      `;
      
      // Updating SweetAlert with the new message
      Swal.update({ 
          html: processingMessage,
          showConfirmButton: false, // Ensure the confirm button remains hidden
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    };

    const updateProgressWithDelayForChaCha = async (progress: number): Promise<void> => {
      processingMessage = `
      <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('decryption-step2')}</p>
      <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">
          ${t('progress')}: ${progress.toFixed(2)}%
      </p>
      <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>
      `;
      
      // Updating SweetAlert with the new message
      Swal.update({ 
          html: processingMessage,
          showConfirmButton: false, // Ensure the confirm button remains hidden
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    };
  
    const decryptedData: number[] = [];
    const dataLengthNoLC = bytes.length - chunkSize;
    for (let i = 48; i < dataLengthNoLC; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      const decryptedChunk = await decryptSerpent256ECB(chunk, blockCipherKey);
      const xorChunk = decryptedChunk.map((byte, index) => byte ^ previousCiphertext[index]);
      xorChunk.forEach(byte => decryptedData.push(byte));
      previousCiphertext = chunk;
  
      if ((i - 112) % 16000 === 0) {
        await updateProgressWithDelayForSerpent(((i - 112) / (dataLengthNoLC - 112)) * 100);
      }
    }
  
    // Handle padding in the last block
    const encryptedLastBlock = bytes.slice(bytes.length - chunkSize);
    const decryptedLastBlock = await decryptSerpent256ECB(encryptedLastBlock, blockCipherKey);
    const decryptedLastBlockXORed = decryptedLastBlock.map((byte, index) => byte ^ previousCiphertext[index]);
    const paddingLength = pkcs7PaddingConsumed(decryptedLastBlockXORed);
    await updateProgressWithDelayForSerpent(100);
    let invalidPadding = false;
    if (paddingLength === 0) {
      invalidPadding = true;
    } else if (paddingLength === 16) {
      // Do nothing
    } else {
      const unpaddedLastBlock = decryptedLastBlockXORed.slice(0, 16 - paddingLength);
      unpaddedLastBlock.forEach(byte => decryptedData.push(byte));
    }
  
    const decryptedDataUint8Array = new Uint8Array(decryptedData);
  
    //toggleProgressAnimation(false);
    //setProcessingStep('Step 2/2 - Decrypting file with ChaCha20');
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
      const progress = (streamCipherOffset / decryptedDataUint8Array.length) * 100;
      await updateProgressWithDelayForChaCha(progress);
    }
    const decryptedWithStreamCipher = decryptedChunks.slice(0, decryptedOffset);
    //setProcessingStep('Verifying file integrity');
    const newTag = await computeTagForFileUsingHMACSHA512(hmacKey, decryptedWithStreamCipher);
    let integrityFailed = false;
    for (let i = 0; i < 64; i++) {
      if (decryptedTag[i] !== newTag[i]) {
        integrityFailed = true;
        break;
      }
    }
  
    // Prepare decrypted data in 16-byte chunks
    const finalChunkSize = 16;
    const finalDecryptedChunks: Uint8Array[] = [];
    for (let i = 0; i < decryptedWithStreamCipher.length; i += finalChunkSize) {
      finalDecryptedChunks.push(decryptedWithStreamCipher.slice(i, i + finalChunkSize));
    }
    const decryptedFile = new Blob(finalDecryptedChunks, { type: 'application/octet-stream' });
    const url = URL.createObjectURL(decryptedFile);
  
    let messages: string[] = [];
  
    if (invalidPadding && integrityFailed) {
      messages = ['Decryption errors: invalid padding, integrity/authenticity verification failed'];
    } else if (invalidPadding) {
      messages = ['Decryption error: invalid padding'];
    } else if (integrityFailed) {
      messages = ['File integrity verification failed. The file may be corrupted or tampered with.'];
    } else {
      messages = ['File decrypted successfully', 'File integrity verified successfully'];
  
      const recordVerificationKey = derivedKey.slice(224);
      const filenameBytes = new TextEncoder().encode(container.title);
      const descriptionBytes = new TextEncoder().encode(container.description);
      const combinedData = new Uint8Array(filenameBytes.length + descriptionBytes.length + decryptedTag.length);
      combinedData.set(filenameBytes, 0);
      combinedData.set(descriptionBytes, filenameBytes.length);
      combinedData.set(decryptedTag, filenameBytes.length + descriptionBytes.length);
      
      const calculatedRecordTag = await computeTagForRecordUsingHMACSHA512(recordVerificationKey.slice(96), combinedData);
      let decryptedRecordTag;

      if (typeof containerHelper.encryptedTag === 'string') {
        // Decrypt the tag since it is a valid hex string with exactly 160 characters
        decryptedRecordTag = await decryptRecordTagWithTwoCiphersCBC(containerHelper.encryptedTag, recordVerificationKey);
      } else {
        // Set to a Uint8Array with one element (0) if the conditions are not met
        decryptedRecordTag = new Uint8Array(1);
        decryptedRecordTag[0] = 0; // Set the first element to 0
      }
      //console.log("Decrypted tag:", decryptedRecordTag);
      //console.log("Calculated tag:", calculatedRecordTag);
      const recordIntegrity = compareUint8Arrays(calculatedRecordTag, decryptedRecordTag);
  
      const metadataIssues: string[] = [];
  
      if (!recordIntegrity) {
        metadataIssues.push('Record integrity verification failed');
      }
      if (!containerHelper.titleIntegrity) {
        metadataIssues.push('Title integrity verification failed');
      }
      if (!containerHelper.titlePaddingValidity) {
        metadataIssues.push('Title padding is invalid');
      }
      if (!containerHelper.decryptedDescriptionIntegrity) {
        metadataIssues.push('Description integrity verification failed');
      }
      if (!containerHelper.decryptedDescriptionPaddingValidity) {
        metadataIssues.push('Description padding is invalid');
      }
  
      if (metadataIssues.length === 0) {
        messages.push('Metadata integrity verified successfully');
      } else {
        messages.push('There are issues with the file metadata:');
        messages = messages.concat(metadataIssues);
      }
    }
    Swal.close();
    //console.log(messages);
    //console.log(finalDecryptedChunks);
    //console.log(container);
    //console.log(containerHelper);
    setPopupData({ container, messages, fileUrl: url });
    setIsPopupVisible(true);
  };

  const computeTagForFileUsingHMACSHA512 = useCallback(async (key: Uint8Array, data: Uint8Array) => {
    let processingMessage = `
    <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('computing-tag-for-file-using-hmac-sha512')}</p>
    <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>
    `;
    
    // Updating SweetAlert with the new message
    Swal.update({ 
        html: processingMessage,
        showConfirmButton: false, // Ensure the confirm button remains hidden
    });
    const chunkSize = 256 * 1024; // 256 KB chunks
    let offset = 0;
    const hmac = await createHMAC(createSHA512(), key);
    hmac.init();
  
    async function updateProgressWithDelay(progress: number) {
      processingMessage = `
      <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('computing-tag-for-file-using-hmac-sha512')}</p>
      <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">
          ${t('progress')}: ${progress.toFixed(2)}%
      </p>
      <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>
      `;
      
      // Updating SweetAlert with the new message
      Swal.update({ 
          html: processingMessage,
          showConfirmButton: false, // Ensure the confirm button remains hidden
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  
    while (offset < data.length) {
      const chunk = data.slice(offset, Math.min(offset + chunkSize, data.length));
      hmac.update(chunk);
      offset += chunk.length;
  
      const progress = (offset / data.length) * 100;
      await updateProgressWithDelay(progress);
    }
    processingMessage = `
    <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('finalizing-tag-computation')}</p>
    <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>
    `;
    
    // Updating SweetAlert with the new message
    Swal.update({ 
        html: processingMessage,
        showConfirmButton: false, // Ensure the confirm button remains hidden
    });
    Swal.showLoading();
    await new Promise(resolve => setTimeout(resolve, 50));
  
    const signature = hmac.digest('binary');
    return new Uint8Array(signature);
  }, []);

  const decryptRecordTagWithTwoCiphersCBC = async (
    input: string, 
    derivedKey: Uint8Array, 
  ): Promise<Uint8Array> => {
    const chunkSize = 16;
    const bytes = base64ToUint8Array(input);

    if (bytes.length > 1 && bytes.length % 16 === 0) {

    } else {
      return new Uint8Array([1]);
    }
  
    let chacha20key = new Uint8Array(derivedKey.slice(0, 64));
    const blockCipherKey = derivedKey.slice(64, 96);
  
    const extractedIV = bytes.slice(0, 16);
    const decryptedIV = await decryptSerpent256ECB(extractedIV, blockCipherKey);
    let previousCiphertext = decryptedIV;
  
    const decryptedData: number[] = [];
    const dataLength = bytes.length;
    for (let i = 16; i < dataLength; i += chunkSize) {
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
  
    return decryptedChunks;
  };

  const initiateDownload = async () => {
    //console.log(fileTagForDownloader);
    const parts = fileTagForDownloader.split(',');

    if (parts.length !== 4 || !parts[0] || !parts[1]) {
      Swal.fire({
        icon: "error",
        title: t('error_inscription'),
        html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('invalid-tag')}</p>`,
        width: 600,
        padding: "3em",
        color: "var(--foreground)",
        background: "var(--background)",
        confirmButtonText: t('ok_button'),
        confirmButtonColor: "var(--firstThemeColor)"
      });
      return;
    }
    
    try {
      if (!fileTagForDownloader) return;
    
      const parts = fileTagForDownloader.split(',');
      if (parts.length !== 4) {
        console.error("Invalid tag format");
        return;
      }
      Swal.fire({
        title: t('initiating-file-download'),
        html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>`,
        color: "var(--foreground)",
        background: "var(--background)",
        width: 720,
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });  
      const userEmail = `${parts[0]}@plum-harbor.app`;
      const documentId = parts[1]; // This is the actual document name
    
      const decryptedFileKey = base64ToUint8Array(parts[3]);
      const decryptedMetadataKey = base64ToUint8Array(parts[2]);
      //console.log("File Key:", decryptedFileKey);
      //console.log("Metadata Key:", decryptedMetadataKey);
      if (decryptedFileKey || decryptedMetadataKey) {
        // Create a reference to the document
        const fileDocRef = doc(db, "data", userEmail, "public", "files", "metadata", documentId);
        
        // Fetch the data
        const docSnap = await getDoc(fileDocRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as {
            encryptedFilename: string;
            encryptedDescription: string;
            fileSize: number;
            encryptedTag: string;
            encryptedLength: number;
          };
          /*
          console.log("Encrypted Filename:", data.encryptedFilename);
          console.log("Encrypted Description:", data.encryptedDescription);
          console.log("File Size:", data.fileSize);
          console.log("Encrypted Tag:", data.encryptedTag);
          console.log("Encrypted Length:", data.encryptedLength);
          */
          let decryptedFilename = 'Broken Metadata';
          let titleIntegrity = false;
          let titlePaddingValidity = false;
          let decryptedDescription = 'Broken Metadata';
          let decryptedDescriptionIntegrity = false;
          let decryptedDescriptionPaddingValidity = false;
    
          if (decryptedMetadataKey) {
            const metadataKeyArray = await deriveBytesUsingArgon2id(
              decryptedMetadataKey.slice(26),
              decryptedMetadataKey.slice(0, 26),
              14,
              350
            );
            if (data.encryptedFilename && data.encryptedFilename.trim() !== '') {
              const decoded = base64ToUint8Array(data.encryptedFilename);
              if (decoded.length % 16 === 0) {
                const [decryptedFileNameArray, integrity, paddingValidity] = await decryptStringWithTwoCiphersCBC(decoded, metadataKeyArray.slice(0, 175), 50);
                decryptedFilename = new TextDecoder().decode(decryptedFileNameArray);
                titleIntegrity = integrity;
                titlePaddingValidity = paddingValidity;
              }
            }
    
            if (data.encryptedDescription && data.encryptedDescription.trim() !== '') {
              if (data.encryptedDescription !== "Tm8gZGVzY3JpcHRpb24u") {
                const decoded = base64ToUint8Array(data.encryptedDescription);
                if (decoded.length % 16 === 0) {
                  const [decryptedFileDescriptionArray, descrIntegrity, descrPaddingValidity] = await decryptStringWithTwoCiphersCBC(decoded, metadataKeyArray.slice(175), 50);
                  decryptedDescription = new TextDecoder().decode(decryptedFileDescriptionArray);
                  decryptedDescriptionIntegrity = descrIntegrity;
                  decryptedDescriptionPaddingValidity = descrPaddingValidity;
                }
              } else {
                decryptedDescription = 'No description.';
                decryptedDescriptionIntegrity = true;
                decryptedDescriptionPaddingValidity = true;
              }
            }
          }
    
          let fileSizeString = 'Unknown';
          if (typeof data.fileSize === 'number' && data.fileSize > 0) {
            fileSizeString = generateFileSizeString(data.fileSize);
          }
    
          const extension = decryptedFilename.split('.').pop() || '';
          const fileType = fileTypeClassification.find(type => type.extensions.includes(`.${extension}`));
    
          const metadataIntegrity: boolean =
            titleIntegrity && titlePaddingValidity &&
            decryptedDescriptionIntegrity &&
            decryptedDescriptionPaddingValidity;
    
          const newContainer: Container = {
            id: docSnap.id,
            title: decryptedFilename,
            color: fileType ? fileType.color : '#3D4785',
            fileSize: `SIZE: ${fileSizeString}`,
            description: decryptedDescription,
            metadataIntegrity
          };
    
          const newContainerHelper: ContainerHelper = {
            id: docSnap.id,
            titleIntegrity,
            titlePaddingValidity,
            decryptedDescriptionIntegrity,
            decryptedDescriptionPaddingValidity,
            encryptedTag: data.encryptedTag,
            encryptedLength: data.encryptedLength,
          };
    
          //console.log(newContainer);
          //console.log(newContainerHelper);
          if (decryptedFileKey){
            await onDownload (newContainer, newContainerHelper, userEmail, decryptedFileKey) 
          }
        } else {
            console.error("Can't access the metadata of the file with id: \"", documentId, "\"");
            const errorMessage = `
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('unable-to-access-the-file-metadata')}</p>
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('the-file-may-have-been-removed')}</p>
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('or-the-file-tag-is-corrupted')}</p>
            `;
            
            Swal.fire({
                icon: "error",
                title: t('error_inscription'),
                html: errorMessage,
                width: 640,
                padding: "3em",
                color: "var(--foreground)",
                background: "var(--background)",
                confirmButtonText: t('ok_button'),
                confirmButtonColor: "var(--firstThemeColor)"
            }).then((result) => {
                if (result.isConfirmed) {
                    onComplete();
                }
            });
          
            Swal.fire({
              icon: "error",
              title: t('error_inscription'),
              html: errorMessage,
              width: 600,
              padding: "3em",
              color: "var(--foreground)",
              background: "var(--background)",
              confirmButtonText: t('ok_button'),
              confirmButtonColor: "var(--firstThemeColor)"
            }).then((result) => {
              if (result.isConfirmed) {
                onComplete();
              }
            });
            return;
        }
      } else {

      }
    } catch (error) {
        console.error('Error fetching file data:', error);
        const errorMessage = `
        <p style="margin-bottom: 10px;">Error fetching file data:</p>
        <p>${error instanceof Error ? error.message : 'Unknown error'}</p>`;
      
        Swal.fire({
          icon: "error",
          title: t('error_inscription'),
          html: errorMessage,
          width: 600,
          padding: "3em",
          color: "var(--foreground)",
          background: "var(--background)",
          confirmButtonText: t('ok_button'),
          confirmButtonColor: "var(--firstThemeColor)"
        }).then((result) => {
          if (result.isConfirmed) {
            onComplete();
          }
        });
        return;
    }
  };

  useImperativeHandle(ref, () => ({
    initiateDownload
  }));

  useEffect(() => {
    if (fileTagForDownloader && fileTagForDownloader !== lastProcessedTagRef.current) {
      initiateDownload();
      lastProcessedTagRef.current = fileTagForDownloader;
    }
  }, [fileTagForDownloader]);

  return (
    <>
      {/* Your existing component JSX */}
      {isPopupVisible && popupData && (
        <FileDownloadComponent
          container={popupData.container}
          messages={popupData.messages}
          fileUrl={popupData.fileUrl}
          onSave={() => {
            const a = document.createElement('a');
            a.href = popupData.fileUrl!;
            a.download = popupData.container.title;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
          onClose={() => {
            if (popupData.fileUrl) {
              URL.revokeObjectURL(popupData.fileUrl);
            }
            setIsPopupVisible(false);
            onComplete();
          }}
        />
      )}
    </>
  );
});

FileDownloader.displayName = 'FileDownloader';

export default FileDownloader;