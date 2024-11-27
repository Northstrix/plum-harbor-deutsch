"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { decryptSerpent256ECB } from '@/app/cryptographicPrimitives/serpent';
import { createSHA512, createHMAC, whirlpool, argon2id, sha512 } from 'hash-wasm';
import { ChaCha20 } from 'mipher';
import useStore from '@/store/store';
import { db, auth } from '@/app/lib/firebase';
import { doc, getDoc, getDocs, deleteDoc, collection, getFirestore } from "firebase/firestore"; 
import { useTranslation } from 'next-i18next';
import Swal from 'sweetalert2';
import ChronicleButton from '@/components/ui/ChronicleButton/ChronicleButton';
import FileTagPopup from '@/components/File-Related/FileTagPopup';
import FileOptions from '@/components/File-Related/FileOptions';
import SendFile from '@/components/File-Related/SendFile';
import FileDownloader from '@/components/File-Related/FileDownloader';

interface DecryptedFileTag {
  id: string;
  recipientId: Uint8Array;
  tag: Uint8Array;
  fileName: string;
  fileSize: string;
  description: string;
  integrity: boolean;
  validity: boolean;
  color:string;
  metadataIntegrity: boolean;
}

interface FileData {
  id: string;
  encryptedFilename: string;
  encryptedDescription: string;
  encryptedTag: string;
  fileSize: number;
  encryptedLength: number;
}

interface SentFileTag {
  data: string;
}

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

interface FileType {
  color:string;
  type:string;
  extensions:string[];
}

const generateFileSizeString = (sizeInBytes: number): string => {
  if (sizeInBytes >= 1024 * 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  } else if (sizeInBytes >= 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
  } else if (sizeInBytes >= 1024) {
    return `${(sizeInBytes / 1024).toFixed(2)} KB`;
  } else if (sizeInBytes === 1) {
    return `1 byte`;
  } else {
    return `${sizeInBytes.toFixed(0)} bytes`;
  }
};

export default function SentFilesContent() {
  const [tags, setTags] = useState<DecryptedFileTag[]>([]);
  const { masterKey, iterations } = useStore();
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [popupMessageLine1, setPopupMessageLine1] = useState('');
  const [popupMessageLine2, setPopupMessageLine2] = useState('');
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [showTagPopup, setShowTagPopup] = useState(false);
  const [popupData, setPopupData] = useState<{ id: string; title: string; color: string; fileSize: string; fileTag: string } | null>(null);
  const [showFileOptions, setShowFileOptions] = useState(false);
  const [fileOptionsData, setFileOptionsData] = useState<{
      id: string; 
      title: string; 
      color: string; 
      fileSize: string; 
      fullDescription: string;
  } | null>(null);
  const [showSendFile, setShowSendFile] = useState(false);
  const [sendFile, setSendFileData] = useState<{
      title: string; 
      color: string; 
      fileSize: string; 
      tag: string;
  } | null>(null);
  const [fileTagForDownloader, setFileTagForDownloader] = useState<string | null>(null);
  const downloaderRef = useRef<{ initiateDownload?: () => void }>(null);
  
const executionRef = useRef(false);

const extractRecordsFromFirebase = () => {
  if (executionRef.current) {
    return;
  }
  executionRef.current = true;
  const fetchLogins = async () => {
    showTwoLinedPopup("Fetching your records", "Please wait for a while");
    setTags([]);
    try {
      const user = auth.currentUser;
      if (!auth.currentUser) {
        showTwoLinedPopup('Authentication Error', 'Oops! It looks like your session has expired. Please refresh the page and try logging in again.');
        await new Promise(() => {});
        throw new Error('User not authenticated');
      }
      if (!user) throw new Error('User not authenticated');

      const new_iterations: number = Math.round(250 + (iterations / 18));

      const db = getFirestore(); // Initialize Firestore

                const tagsRef = collection(db, `data/${user.email}/private/encrypted/sentFileTags`);
                const querySnapshot = await getDocs(tagsRef);
                let fileIndex = 0; // Initialize fileIndex
          
                // Create a set to track processed IDs
                const processedIds = new Set<string>();
          
                // Process each document in the query snapshot
                for (const doc of querySnapshot.docs) {
                  const data = doc.data() as SentFileTag
                  ;
                  fileIndex++;
          
                  await new Promise(resolve => setTimeout(resolve, 25));
                  // Show pop-up for decrypting each record
                  showTwoLinedPopup(`Decrypting sent tag N${fileIndex}/${querySnapshot.docs.length}`, "Please wait for a while");
                  await new Promise(resolve => setTimeout(resolve, 25));
                  // Check if this ID has already been processed
                  if (processedIds.has(doc.id)) {
                    console.warn(`Record with ID ${doc.id} has already been processed. Skipping.`);
                    continue; // Skip this record if it's already processed
                  }
          
                  try {
                    let validity = false;
                    let integrity = false;
                    let recipientId: Uint8Array | undefined; // Predefine the variable
                    let decryptedTag: Uint8Array | undefined; // Predefine the variable
                    let ftitle;
                    let fcolor;
                    let ffileSize;
                    let fdescription;
                    let fmetadataIntegrity = false;
                  
                    // Decrypt fields only if they are present and valid
                  
                          const encryptedFileTag = base64ToUint8Array(data.data);
                          if (encryptedFileTag.length > 1 && encryptedFileTag.length % 16 === 0) {
                              const [decryptedWithStreamCipher, integrityCheckPassed, paddingValid] = await decryptStringWithTwoCiphersCBC(encryptedFileTag, masterKey, new_iterations);
                              recipientId = decryptedWithStreamCipher.slice(0, 16);
                              decryptedTag = decryptedWithStreamCipher.slice(16);
                              // Set validity based on whether the tag was decrypted
                              validity = true; // Set to true since we have decrypted the tag
                              
                              if (integrityCheckPassed === true && paddingValid === true) {
                                // Successful decryption and integrity check passed
                                integrity = true; // Set integrity to true
                              } else {
                                // Broken tag integrity
                                integrity = false; // Set integrity to false
                                console.warn('Broken tag integrity detected.');
                              }
                              const metadata = await getFileMetadataById(decryptedTag);
                              const { title, color, fileSize, description, metadataIntegrity } = metadata;
                              ftitle = title;
                              fcolor = color;
                              ffileSize = fileSize;
                              fdescription = description;
                              fmetadataIntegrity = metadataIntegrity;
                          } else {
                            // Invalid file tag
                            validity = false; // Set validity to false
                            integrity = false; // Set integrity to false
                            console.warn('Invalid file tag detected.');
                            ftitle = 'Invalid file tag detected.';
                            fdescription = 'Invalid file tag detected.';
                          }

                  
                    // Create a new DecryptedFileTag object after all checks
                    const newDecryptedFileTag: DecryptedFileTag = {
                      id: doc.id || 'unknown', // Use a default value or handle it appropriately if data.id doesn't exist
                      recipientId: recipientId || new Uint8Array([1]), // Use decrypted data or placeholder
                      tag: decryptedTag || new Uint8Array([1]), // Use decrypted data or placeholder
                      fileName: ftitle || 'Untitled', // Assign title to fileName, with a default if undefined
                      fileSize: ffileSize || "Unknown",
                      description: fdescription || 'No description.', // Assign description with a default
                      integrity: integrity, // Direct assignment
                      validity: validity, // Direct assignment
                      color: fcolor || '#3D4785', // Assign color with a default if undefined
                      metadataIntegrity: fmetadataIntegrity // Direct assignment
                    };
                  
                    // Update state with the new decrypted file tag immediately
                    setTags(prevTags => [...prevTags, newDecryptedFileTag]);
                  
                    // Add the ID to the processed set (assuming processedIds is defined)
                    processedIds.add(doc.id);
                  
                  } catch (error) {
                    console.error('Error handling received file tag(s):', error);
                    setIsPopupVisible(false);
                    somethingWentWrongError();
                  }
                }
      setIsPopupVisible(false);

    } catch (error) {
      console.error('Error fetching tags:', error);
      //toast.error(`Error fetching tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
      somethingWentWrongError();
    }
  };
  fetchLogins();
};

const somethingWentWrongError = async() =>{
  showTwoLinedPopup(t('something_went_wrong_line1'), t('check_the_console'));
  return;
}

useEffect(() => {
  extractRecordsFromFirebase();
}, []);

const getFileMetadataById = async (uint8Array: Uint8Array): Promise<{ 
  title: string; 
  color: string; 
  fileSize: string; 
  description: string; 
  metadataIntegrity: boolean; 
}> => {
  const userId = String.fromCharCode(...uint8Array.subarray(0, 16)); // First 16 bytes to ASCII
  const fileId = String.fromCharCode(...uint8Array.subarray(16, 26)); // Next 10 bytes to ASCII
  //console.log(`User ID: ${userId}`);
  //console.log(`File ID: ${fileId}`);
  const decryptedMetadataKey = uint8Array.subarray(26, 154); // Next 128 bytes for Base64
  const docRef = doc(db, `data/${userId}@plum-harbor.app/public/files/metadata`, fileId);
  const docSnapshot = await getDoc(docRef);

  if (docSnapshot.exists()) {

    const data = docSnapshot.data() as FileData;
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
  
    return {
      title: decryptedFilename,
      color: fileType ? fileType.color : '#3D4785',
      fileSize: `${fileSizeString}`,
      description: decryptedDescription,
      metadataIntegrity
    };
  } else {
    return {
      title: "File doesn't exist",
      color: '#3D4785',
      fileSize: "Unknown",
      description: "File doesn't exist",
      metadataIntegrity: false
    };
  }
};

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

function convertArrayIntoTheTag(uint8Array: Uint8Array): string {
  // Ensure the input is a Uint8Array
  if (!(uint8Array instanceof Uint8Array)) {
      throw new Error("Input must be a Uint8Array");
  }

  // Extracting parts from the Uint8Array
  const userId = String.fromCharCode(...uint8Array.subarray(0, 16)); // First 16 bytes to ASCII
  const fileId = String.fromCharCode(...uint8Array.subarray(16, 26)); // Next 10 bytes to ASCII
  const metadataKey = uint8Array.subarray(26, 154); // Next 128 bytes for Base64
  const fileKey = uint8Array.subarray(154, 362); // Last 208 bytes for Base64

  // Encoding to Base64
  const base64Encode = (data: Uint8Array): string => {
      let binaryString = '';
      for (let i = 0; i < data.length; i++) {
          binaryString += String.fromCharCode(data[i]);
      }
      return btoa(binaryString);
  };

  // Convert metadataKey and fileKey to Base64 strings
  const metadataKeyBase64 = base64Encode(metadataKey);
  const fileKeyBase64 = base64Encode(fileKey);

  // Constructing the final result string
  return `${userId},${fileId},${metadataKeyBase64},${fileKeyBase64}`;
}

  const showTwoLinedPopup = (messageLine1: string, messageLine2: string) => {
    setIsPopupVisible(false);
    setPopupMessageLine1(messageLine1);
    setPopupMessageLine2(messageLine2);
    setIsPopupVisible(true);
};

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: fileOptionsData?.title || '',
      html: `
        <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('delete_file_tag_confirmation')}</p>
        <p dir="${isRTL ? 'rtl' : 'ltr'}">${t('delete_file_warning')}</p>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: t('delete_confirm'),
      cancelButtonText: t('delete_cancel'),
      reverseButtons: isRTL,
      width: 640,
      padding: "3em",
      color: "var(--foreground)",
      background: "var(--background)",
      confirmButtonColor: "var(--generalErrorColor)",
      cancelButtonColor: "var(--firstThemeColor)"
    });
  
    if (result.isConfirmed) {
      const currentRecord = fileOptionsData?.id;
      //setShowConfirmPopUp(false);
      if (!currentRecord) {
        //toast.error('No record selected for deletion');
        return;
      }
      const processingMessage = `
      <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('deleting-file-tag')}</p>
      <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>
      `;
      Swal.fire({
        title: fileOptionsData?.title,
        color: "var(--foreground)",
        background: "var(--background)",
        width: 720,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
      });
    
      Swal.update({ 
          html: processingMessage,
          showConfirmButton: false,
      });
      try{
        if (!auth.currentUser) {
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
    
        // Create a document reference in Firestore
        const docRef = doc(db, `data/${user.email}/private/encrypted/sentFileTags`, currentRecord);
    
        // Delete the document from Firestore
        await deleteDoc(docRef);
    
        // Update local state by removing the deleted login
        setTags(prevLogins => prevLogins.filter(login => login.id !== currentRecord));
    
        // Show success toast notification
        //toast.success('Record deleted successfully!');
        //createNotification('success', 'Success', 'Record deleted successfully!');
        await new Promise(resolve => setTimeout(resolve, 75));
        Swal.fire({
          icon: "success",
          title: t('file-tag-deleted-successfully-top'), // Adjust translation key as needed
          width: 720,
          padding: "3em",
          color: "var(--foreground)",
          background: "var(--background)",
          confirmButtonText: t('ok_button'),
          confirmButtonColor: "var(--firstThemeColor)"
        });
        await new Promise(resolve => setTimeout(resolve, 75));
    
    
      } catch (error) {
        // For other errors, show the error message and close the processing popup
        console.error('Error deleting the tag of the "', fileOptionsData?.title, '" file from the firebase:', error); // Log the error to the console

        const warningMessage = `
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('failed-to-delete-file-tag')}</p>
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
    }
    setShowFileOptions(false);
    setFileOptionsData(null);
  };

  const onDownload = (id: string) => {
    //console.log(`Download file with ID: ${id}`);
    handleCloseFileOptions();
    const container = tags.find(c => c.id === id);
    if (container){
      const { tag } = container;
      setFileTagForDownloader(convertArrayIntoTheTag(tag));
      downloaderRef.current?.initiateDownload?.();
    }
  };

  const handleCloseFileOptions = () => {
    setShowFileOptions(false);
    setFileOptionsData(null);
  };

  // Demo function for showing all options
  const onShowAllOptions = (id: string) => {
    const container = tags.find(c => c.id === id);
    if (container) {
      setFileOptionsData({
        id: container.id, // Include id here
        title: container.fileName,
        color: container.color,
        fileSize: container.fileSize,
        fullDescription: container.description,
      });
      setShowFileOptions(true);
    }
  };

  const handleRefresh = async () => {
    showTwoLinedPopup("Fetching your records", "Please wait for a while");
    setTags([]);
    try {
      const user = auth.currentUser;
      if (!auth.currentUser) {
        showTwoLinedPopup('Authentication Error', 'Oops! It looks like your session has expired. Please refresh the page and try logging in again.');
        await new Promise(() => {});
        throw new Error('User not authenticated');
      }
      if (!user) throw new Error('User not authenticated');

      const new_iterations: number = Math.round(250 + (iterations / 18));

      const db = getFirestore(); // Initialize Firestore

                const tagsRef = collection(db, `data/${user.email}/private/encrypted/sentFileTags`);
                const querySnapshot = await getDocs(tagsRef);
                let fileIndex = 0; // Initialize fileIndex
          
                // Create a set to track processed IDs
                const processedIds = new Set<string>();
          
                // Process each document in the query snapshot
                for (const doc of querySnapshot.docs) {
                  const data = doc.data() as SentFileTag
                  ;
                  fileIndex++;
                  await new Promise(resolve => setTimeout(resolve, 25));
                  // Show pop-up for decrypting each record
                  showTwoLinedPopup(`Decrypting sent tag N${fileIndex}/${querySnapshot.docs.length}`, "Please wait for a while");
                  await new Promise(resolve => setTimeout(resolve, 25));
                  // Check if this ID has already been processed
                  if (processedIds.has(doc.id)) {
                    console.warn(`Record with ID ${doc.id} has already been processed. Skipping.`);
                    continue; // Skip this record if it's already processed
                  }
          
                  try {
                    let validity = false;
                    let integrity = false;
                    let recipientId: Uint8Array | undefined; // Predefine the variable
                    let decryptedTag: Uint8Array | undefined; // Predefine the variable
                    let ftitle;
                    let fcolor;
                    let ffileSize;
                    let fdescription;
                    let fmetadataIntegrity = false;
                  
                    // Decrypt fields only if they are present and valid
                  
                          const encryptedFileTag = base64ToUint8Array(data.data);
                          if (encryptedFileTag.length > 1 && encryptedFileTag.length % 16 === 0) {
                              const [decryptedWithStreamCipher, integrityCheckPassed, paddingValid] = await decryptStringWithTwoCiphersCBC(encryptedFileTag, masterKey, new_iterations);
                              recipientId = decryptedWithStreamCipher.slice(0, 16);
                              decryptedTag = decryptedWithStreamCipher.slice(16);
                              // Set validity based on whether the tag was decrypted
                              validity = true; // Set to true since we have decrypted the tag
                              
                              if (integrityCheckPassed === true && paddingValid === true) {
                                // Successful decryption and integrity check passed
                                integrity = true; // Set integrity to true
                              } else {
                                // Broken tag integrity
                                integrity = false; // Set integrity to false
                                console.warn('Broken tag integrity detected.');
                              }
                              const metadata = await getFileMetadataById(decryptedTag);
                              const { title, color, fileSize, description, metadataIntegrity } = metadata;
                              ftitle = title;
                              fcolor = color;
                              ffileSize = fileSize;
                              fdescription = description;
                              fmetadataIntegrity = metadataIntegrity;
                          } else {
                            // Invalid file tag
                            validity = false; // Set validity to false
                            integrity = false; // Set integrity to false
                            console.warn('Invalid file tag detected.');
                            ftitle = 'Invalid file tag detected.';
                            fdescription = 'Invalid file tag detected.';
                          }

                  
                    // Create a new DecryptedFileTag object after all checks
                    const newDecryptedFileTag: DecryptedFileTag = {
                      id: doc.id || 'unknown', // Use a default value or handle it appropriately if data.id doesn't exist
                      recipientId: recipientId || new Uint8Array([1]), // Use decrypted data or placeholder
                      tag: decryptedTag || new Uint8Array([1]), // Use decrypted data or placeholder
                      fileName: ftitle || 'Untitled', // Assign title to fileName, with a default if undefined
                      fileSize: ffileSize || "Unknown",
                      description: fdescription || 'No description.', // Assign description with a default
                      integrity: integrity, // Direct assignment
                      validity: validity, // Direct assignment
                      color: fcolor || '#3D4785', // Assign color with a default if undefined
                      metadataIntegrity: fmetadataIntegrity // Direct assignment
                    };
                  
                    // Update state with the new decrypted file tag immediately
                    setTags(prevTags => [...prevTags, newDecryptedFileTag]);
                  
                    // Add the ID to the processed set (assuming processedIds is defined)
                    processedIds.add(doc.id);
                  
                  } catch (error) {
                    console.error('Error handling received file tag(s):', error);
                    setIsPopupVisible(false);
                    somethingWentWrongError();
                  }
                }
      setIsPopupVisible(false);

    } catch (error) {
      console.error('Error fetching tags:', error);
      //toast.error(`Error fetching tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
      somethingWentWrongError();
    }
  }

  const handleDownloadComplete = useCallback(() => {
    setFileTagForDownloader(null);
  }, []);

  const handleDownload = async () => {
    const id = fileOptionsData?.id;
    handleCloseFileOptions();
    const container = tags.find(c => c.id === id);
    if (container){
      const { tag } = container;
      setFileTagForDownloader(convertArrayIntoTheTag(tag));
      downloaderRef.current?.initiateDownload?.();
    }
  };

  const handleGetTagFromAllOptions = async () => {
    const id =  fileOptionsData?.id;
    if (!id)
      return;

    const container = tags.find(c => c.id === id);

    if (container) {

      setPopupData({
        id,
        title: container.fileName,
        color: container.color,
        fileSize: container.fileSize,
        fileTag: convertArrayIntoTheTag(container.tag),
      });

      setShowTagPopup(true);
      handleCloseFileOptions();
    } else {
      console.log('Container or helper not found for ID:', id);
    }
};

  const handleSend = async () => {
    const id =  fileOptionsData?.id;
    if (!id)
      return;

    const container = tags.find(c => c.id === id);

    if (container) {

      setSendFileData({
        title: container.fileName,
        color: container.color,
        fileSize: container.fileSize,
        tag: convertArrayIntoTheTag(container.tag),
      });

      setShowSendFile(true);
      handleCloseFileOptions();
    } else {
      console.log('Container or helper not found for ID:', id);
    }
  }

  const handleCloseTagPopup = useCallback(() => {
    setShowTagPopup(false);
    setPopupData(null);
  }, []);

  const getDirection = (text: string) => /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/.test(text) ? 'rtl' : 'ltr';

  return (
    <>
    <div style={{ padding: '1.24rem'}}>
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
                    <p className="pop-up-login-container-message-text" dir={isRTL ? 'rtl' : 'ltr'}>{popupMessageLine1}</p>
                    <p className="pop-up-login-container-message-text" dir={isRTL ? 'rtl' : 'ltr'}>{popupMessageLine2}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <style jsx>{`
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
          `}</style>




<div style={{ 
      marginTop: '1.24rem', 
      display: 'flex',
    }}>
      <style>
        {`
          /* Hide scrollbar for Chrome, Safari and Opera */
          .scroll-container::-webkit-scrollbar {
            display: none; 
          }
        `}
      </style>
      <div style={{ flex: 1, marginBottom: '2rem' }}> {/* Space below the table */}
        {tags.length > 0 ? (
          <table style={{
            width: '100%',
            backgroundColor: 'transparent',
            color: 'var(--foreground)',
            borderCollapse: 'collapse',
          }}>
            <thead>
              <tr>
                {isRTL ? (
                  <>
                    <th style={{ textAlign: 'right', padding: '12px', borderBottom: '2px solid var(--foreground)', width: '302px' }}>{t('actions')}</th> {/* Fixed width for actions */}
                    <th style={{ textAlign: 'right', padding: '12px', borderBottom: '2px solid var(--foreground)', width: '350px'  }}>{t('owner')}</th> {/* Fixed width for owner */}
                    <th style={{ textAlign: 'right', padding: '12px', borderBottom: '2px solid var(--foreground)', width: '350px' }}>{t('recipient')}</th> {/* Fixed width for recipient */}
                    <th style={{ textAlign: 'right', padding: '12px', borderBottom: '2px solid var(--foreground)' }}>{t('description')}</th>
                    <th style={{ textAlign: 'right', padding: '12px', borderBottom: '2px solid var(--foreground)', width: '164px' }}>{t('size')}</th> {/* Increased width */}
                    <th style={{ textAlign: 'right', padding: '12px', borderBottom: '2px solid var(--foreground)' }}>{t('file-name')}</th>
                    
                    
                  </>
                ) : (
                  <>
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid var(--foreground)' }}>{t('file-name')}</th>
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid var(--foreground)', width: '164px' }}>{t('size')}</th> {/* Increased width */}
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid var(--foreground)' }}>{t('description')}</th>
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid var(--foreground)', width: '350px' }}>{t('recipient')}</th> {/* Fixed width for recipient */}
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid var(--foreground)', width: '350px' }}>{t('owner')}</th> {/* Fixed width for owner */}
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid var(--foreground)', width: '302px' }}>{t('actions')}</th> {/* Fixed width for actions */}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => {
                const isValid = tag.validity && tag.metadataIntegrity;
                const owner = String.fromCharCode(...tag.tag.subarray(0, 16));
                const recipient = String.fromCharCode(...tag.recipientId.subarray(0, 16));
                return (
                  <tr key={tag.id}>
                    {isRTL ? (
                      <>
                        {/* Actions */}
                        <td style={{
                          width:'302px',
                          display:'flex',
                          justifyContent:'center',
                          alignItems:'center'
                        }}>
                          {/* Button Container */}
                          <div className="button-container" style={{ display:'flex', justifyContent:'center', gap:'10px', paddingTop:'16px' }}>
                            {isRTL?(
                              <>
                                <ChronicleButton 
                                  text={t("all-options")} 
                                  outlined={true} 
                                  width="136px" 
                                  onClick={() => onShowAllOptions(tag.id)} 
                                />
                                <ChronicleButton 
                                  text={t("download")} 
                                  width="136px" 
                                  onClick={() => onDownload(tag.id)} 
                                />
                              </>
                            ):(
                              <>
                                <ChronicleButton 
                                  text={t("download")} 
                                  width="136px" 
                                  onClick={() => onDownload(tag.id)} 
                                />
                                <ChronicleButton 
                                  text={t("all-options")} 
                                  outlined={true} 
                                  width="136px" 
                                  onClick={() => onShowAllOptions(tag.id)} 
                                />
                              </>
                            )}
                          </div>
                        </td>
                        {/* Owner Field */}
                        <td style={{
                          padding:'12px',
                          textAlign: 'right',
                          direction: getDirection(`${owner}@plum-harbor.app`)
                        }}>
                          {isValid ? `${owner}@plum-harbor.app` : ''}
                        </td>
                        {/* Recipient Field */}
                        <td style={{
                          padding:'12px',
                          textAlign: 'right',
                          direction: getDirection(`${recipient}@plum-harbor.app`)
                        }}>
                          {isValid ? `${recipient}@plum-harbor.app` : ''}
                        </td>
                        <td style={{
                          padding:'12px',
                          color:'var(--foreground)',
                          fontWeight:'400',
                          fontSize:'1rem',
                          direction: getDirection(tag.description)
                        }}>
                          {tag.description}
                        </td>
                        <td style={{
                          padding:'12px',
                          textAlign: 'right',
                          color:isValid?'var(--foreground)':'var(--generalErrorColor)',
                          direction: getDirection(tag.fileSize)
                        }}>
                          {isValid ? tag.fileSize : "Unknown"}
                        </td>
                        <td style={{
                          padding:'12px',
                          color:isValid ? tag.color : "var(--generalErrorColor)", // Use tag color for file name
                          direction: getDirection(tag.fileName)
                        }}>
                          {isValid ? tag.fileName : "Invalid record"}
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{
                          padding:'12px',
                          color:isValid ? tag.color : "var(--generalErrorColor)", // Use tag color for file name
                          fontWeight:'400',
                          fontSize:'1rem',
                          direction: getDirection(tag.fileName)
                        }}>
                          {isValid ? tag.fileName : "Invalid record"}
                        </td>
                        <td style={{
                          padding:'12px',
                          color:isValid?'var(--foreground)':'var(--generalErrorColor)',
                          direction: getDirection(tag.fileSize)
                        }}>
                          {isValid ? tag.fileSize : "Unknown"}
                        </td>
                        <td style={{
                          padding:'12px',
                          color:isValid?'var(--foreground)':'var(--generalErrorColor)',
                          direction: getDirection(tag.description)
                        }}>
                          {tag.description}
                        </td>
                        {/* Recipient Field */}
                        <td style={{
                          padding:'12px',
                          direction: getDirection(`${recipient}@plum-harbor.app`)
                        }}>
                          {isValid ? `${recipient}@plum-harbor.app` : ''}
                        </td>
                        {/* Owner Field */}
                        <td style={{
                          padding:'12px',
                          direction: getDirection(`${owner}@plum-harbor.app`)
                        }}>
                          {isValid ? `${owner}@plum-harbor.app` : ''}
                        </td>
                        {/* Actions */}
                        <td style={{
                          width:'302px',
                          display:'flex',
                          justifyContent:'center',
                          alignItems:'center'
                        }}>
                          {/* Button Container */}
                          <div className="button-container" style={{ display:'flex', justifyContent:'center', gap:'10px', paddingTop:'16px' }}>
                            {isRTL?(
                              <>
                                <ChronicleButton
                                  text={t("all-options")}
                                  outlined={true}
                                  width="136px"
                                  onClick={() => onShowAllOptions(tag.id)}
                                />
                                <ChronicleButton
                                  text={t("download")}
                                  width="136px"
                                  onClick={() => onDownload(tag.id)}
                                />
                              </>
                            ):(
                              <>
                                <ChronicleButton
                                  text={t("download")}
                                  width="136px"
                                  onClick={() => onDownload(tag.id)}
                                />
                                <ChronicleButton
                                  text={t("all-options")}
                                  outlined={true}
                                  width="136px"
                                  onClick={() => onShowAllOptions(tag.id)}
                                />
                              </>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="mb-4 text-center"> {/* Padding and margin for spacing */}
          <span 
            className="text-gray-600 cursor-pointer"
          >
            {t('empty')}
          </span>
        </div>
        )}
      </div>
    </div>
    </div>
        <div className="p-4 mb-4 text-center"> {/* Padding and margin for spacing */}
        <span 
          onClick={handleRefresh} 
          className="text-gray-600 cursor-pointer"
        >
          {t('refresh')}
        </span>
      </div>
      {showFileOptions && fileOptionsData && (
          <FileOptions
              title={fileOptionsData.title}
              color={fileOptionsData.color}
              fileSize={fileOptionsData.fileSize}
              fullDescription={fileOptionsData.fullDescription}
              onClose={handleCloseFileOptions}
              onDownload={handleDownload}
              onGetTagFromAllOptions={handleGetTagFromAllOptions}
              onSend={handleSend}
              onDelete={handleDelete}
          />
      )}
      {showTagPopup && popupData && (
        <FileTagPopup
          id={popupData.id}
          title={popupData.title}
          color={popupData.color}
          fileSize={popupData.fileSize}
          fileTag={popupData.fileTag}
          onClose={handleCloseTagPopup}
        />
      )}
      {showSendFile && sendFile && (
          <SendFile
              title={sendFile.title}
              color={sendFile.color}
              fileSize={sendFile.fileSize}
              tag={sendFile.tag}
              onClose={() => setShowSendFile(false)}
          />
      )}
      {fileTagForDownloader && (
        <FileDownloader 
          ref={downloaderRef}
          fileTagForDownloader={fileTagForDownloader} 
          onComplete={handleDownloadComplete}
        />
      )}
      </>
  );
}
