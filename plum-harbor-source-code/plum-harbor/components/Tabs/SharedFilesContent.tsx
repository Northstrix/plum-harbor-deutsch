'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Dropzone from '@/components/File-Related/DropZone';
import FileContainer from '@/components/File-Related/FileContainer';
import { createSHA512, createHMAC, whirlpool, argon2id, sha512 } from 'hash-wasm';
import { ChaCha20 } from 'mipher';
import { encryptSerpent256ECB, decryptSerpent256ECB } from '@/app/cryptographicPrimitives/serpent';
import useStore from '@/store/store';
import { db, auth} from '@/app/lib/firebase';
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, writeBatch } from "firebase/firestore"; 
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';
import FileTagPopup from '@/components/File-Related/FileTagPopup';
import FileOptions from '@/components/File-Related/FileOptions';
import SendFile from '@/components/File-Related/SendFile';
import styles from './TabSwitcher.module.css';
import FileDownloader from '@/components/File-Related/FileDownloader';

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

// File type classification interface
interface FileType {
  color:string;
  type:string;
  extensions:string[];
}

interface Container {
  id:string;
  title:string;
  color:string;
  fileSize:string;
  description:string;
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
 FileKey: string;
 MetadataKey: string;
 keyIntegrity: boolean;
}
 
 class SingletonEffect {
   private static instance: SingletonEffect | null = null;
   private initialized: boolean = false;
 
   private constructor() {}
 
   public static getInstance(): SingletonEffect {
     if (this.instance === null) {
       this.instance = new SingletonEffect();
     }
     return this.instance;
   }
 
   public runEffect(effect: () => void) {
     if (!this.initialized) {
       effect();
       this.initialized = true;
     }
   }
 
   // New method to reset the singleton instance
   public static resetInstance() {
     this.instance = null;
   }
 }

 interface FileData {
  id: string;
  encryptedFilename: string;
  encryptedDescription: string;
  encryptedTag: string;
  fileSize: number;
  encryptedLength: number;
}

const SharedFilesContentContent: React.FC = () => {
    const [containers, setContainers] = useState<Container[]>([]);
    const [containerHelpers, setContainerHelpers] = useState<ContainerHelper[]>([]);
    const [columns, setColumns] = useState<number>(0);
    const [showProcessingPopup, setShowProcessingPopup] = useState(false);
    const [currentFileName, setCurrentFileName] = useState('');
    const [processingStep, setProcessingStep] = useState('');
    const [processingStepDescription, setProcessingStepDescription] = useState('');
    const [processingProgress, setProcessingProgress] = useState(0);
    const progressContainerRef = useRef<HTMLDivElement>(null);
    const {masterKey, iterations} = useStore();
    const [descriptionPopup, setDescriptionPopup] = useState<React.ReactNode | null>(null);
    const { i18n, t } = useTranslation();
    let fileIndex = 0;
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
    

    useEffect(() => {

      Swal.fire({
        title: t('fetching-the-metadata-of-your-files'), // Use translation key for this message
        html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>`, // Use translation key for this message
        color: "var(--foreground)",
        background: "var(--background)",
        width: 720,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    setShowProcessingPopup(false);
      const singleton = SingletonEffect.getInstance();
      singleton.runEffect(async () => {
        try {
          const user = auth.currentUser;
          if (!user) {
            await new Promise(resolve => setTimeout(resolve, 50));
            await show_authentication_error();
            throw new Error('User not authenticated');
          }

          const filesRef = collection(db, `data/${user.email}/public/files/metadata`);
          const querySnapshot = await getDocs(filesRef);
          // Clear existing containers
          setContainers([]);
          setContainerHelpers([]);
          const new_iterations = parseInt((iterations / 10).toString(), 10);
          const processingMessage = `
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('decrypting-the-file-metadata')}</p>
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>
          `;
          
          Swal.fire({
              title: '',
              html: processingMessage,
              color: "var(--foreground)",
              background: "var(--background)",
              width: 720,
              allowOutsideClick: false,
              didOpen: () => {
                  Swal.showLoading();
              }
          });
          
          for (const doc of querySnapshot.docs) {
            fileIndex++;
        
            let title;
            if (i18n.language === "he") {
                // Hebrew version: "מעבד קובץ 1 מתוך 2"
                title = `מעבד קובץ ${fileIndex} מתוך ${querySnapshot.docs.length}`;
            } else {
                // English version: "Processing file 1/2"
                title = `Verarbeite Datei ${fileIndex} von ${querySnapshot.docs.length}`;
            }
        
            Swal.update({ 
                title: title,
                showConfirmButton: false, // Ensure the confirm button remains hidden
            });
            
            // Ensure the loading indicator is still shown after update
            Swal.showLoading();
            //console.log("Container id:", doc.id);

            const [encryptedFileKey, encryptedMetadataKey, encryptedKeyTag] = await getFileKeyContainerById(doc.id);
            
            // Variables to track presence
            const isFileKeyPresent = encryptedFileKey && encryptedFileKey.length > 1;
            const isMetadataKeyPresent = encryptedMetadataKey && encryptedMetadataKey.length > 1;
            const isKeyTagPresent = encryptedKeyTag && encryptedKeyTag.length > 1;
            
            // Declare decrypted keys
            let decryptedFileKey: Uint8Array | null = null;
            let decryptedMetadataKey: Uint8Array | null = null;
            
            // Process the file key
            if (isFileKeyPresent) {
              //console.log('Encrypted File Key:', encryptedFileKey);
              decryptedFileKey = await decryptFieldValueWithTwoCiphersCBC(encryptedFileKey, masterKey, new_iterations);
              //console.log('Decrypted File Key:', decryptedFileKey);
            } else {
              //console.log('Encrypted File Key is missing or invalid.');
            }
            
            // Process the metadata key
            if (isMetadataKeyPresent) {
              //console.log('Encrypted Metadata Key:', encryptedMetadataKey);
              decryptedMetadataKey = await decryptFieldValueWithTwoCiphersCBC(encryptedMetadataKey, masterKey, new_iterations);
              //console.log('Decrypted Metadata Key:', decryptedMetadataKey);
            } else {
              //console.log('Encrypted Metadata Key is missing or invalid.');
            }
            
            // Process the key tag
            if (isKeyTagPresent) {
              //console.log('Encrypted Key Tag:', encryptedKeyTag);
            } else {
              //console.log('Encrypted Key Tag is missing or invalid.');
            }

            if (decryptedFileKey || decryptedMetadataKey) {
              const data = doc.data() as FileData;
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
            
              let keyIntegrity = false;
              if (isFileKeyPresent && isMetadataKeyPresent && isKeyTagPresent && decryptedFileKey && decryptedMetadataKey) {
                const combinedKeyData = new Uint8Array(decryptedFileKey.length + decryptedMetadataKey.length);
                combinedKeyData.set(decryptedFileKey, 0);
                combinedKeyData.set(decryptedMetadataKey, decryptedFileKey.length);
                keyIntegrity = await CheckRecordIntegrity(encryptedKeyTag, masterKey, new_iterations, combinedKeyData);
              }
            
              const metadataIntegrity: boolean = 
                titleIntegrity && titlePaddingValidity && 
                decryptedDescriptionIntegrity && 
                decryptedDescriptionPaddingValidity && keyIntegrity;
            
              const newContainer: Container = {
                id: doc.id,
                title: decryptedFilename,
                color: fileType ? fileType.color : '#3D4785',
                fileSize: `SIZE: ${fileSizeString}`,
                description: decryptedDescription,
                metadataIntegrity
              };

              const newContainerHelper: ContainerHelper = {
                id: doc.id,
                titleIntegrity,
                titlePaddingValidity,
                decryptedDescriptionIntegrity,
                decryptedDescriptionPaddingValidity,
                encryptedTag: data.encryptedTag,
                encryptedLength: data.encryptedLength,
                FileKey: decryptedFileKey ? await uint8ArrayToBase64(decryptedFileKey) : "-1",
                MetadataKey: decryptedMetadataKey ? await uint8ArrayToBase64(decryptedMetadataKey) : "-1",
                keyIntegrity
              };
              
              //console.log(JSON.stringify(newContainer, null, 2));
              //console.log(JSON.stringify(newContainerHelper, null, 2));

              // Update state with the new containers
              setContainers(prevContainers => [...prevContainers, newContainer]);
              setContainerHelpers(prevHelpers => [...prevHelpers, newContainerHelper]);
            } else {            
              const newContainer: Container = {
                id: doc.id,
                title: "Missing Keys",
                color: '#3D4785',
                fileSize: `Size: Irrelevant`,
                description: "Unable to decrypt file metadata",
                metadataIntegrity: false
              };
            
              const newContainerHelper: ContainerHelper = {
                id: doc.id,
                titleIntegrity: false,
                titlePaddingValidity: false,
                decryptedDescriptionIntegrity: false,
                decryptedDescriptionPaddingValidity: false,
                encryptedTag: "-1",
                encryptedLength: 0,
                FileKey: "-1",
                MetadataKey: "-1",
                keyIntegrity: false
              };
            
              // Update state with the new containers
              setContainers(prevContainers => [...prevContainers, newContainer]);
              setContainerHelpers(prevHelpers => [...prevHelpers, newContainerHelper]);
              setShowProcessingPopup(false);
            
              console.log('Container created with missing keys:', doc.id);
            }
          }
          Swal.close();
          SingletonEffect.resetInstance();
        } catch (error) {
          Swal.close();
          console.error('Error fetching file data:', error);
          //toast.error(`Error fetching file data: ${error instanceof Error ? error.message : 'Unknown error'}`);
          createNotification('error', "Error", `Error fetching file data: ${error instanceof Error ? error.message : 'Unknown error'}`);
          /*
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
          });
          */
        } finally {
          Swal.close();
        }
        
        try{
          if (!auth.currentUser) {
            await new Promise(resolve => setTimeout(resolve, 50));
            await show_authentication_error();
            await new Promise(resolve => setTimeout(resolve, 50));
            throw new Error('User not authenticated');
          }
        }
        catch{
  
        }
      });
      return () => {
        // Cleanup logic here if necessary
      };
  
    }, []); // Empty dependency array to run only on mount

    const handleRefresh = async () => {
      const user = auth.currentUser;
      if (!user) {
        await new Promise(resolve => setTimeout(resolve, 50));
        await show_authentication_error();
        return;
      }
      setContainers([]);
      setContainerHelpers([]);
      Swal.fire({
        title: t('fetching-the-metadata-of-your-files'), // Use translation key for this message
        html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>`, // Use translation key for this message
        color: "var(--foreground)",
        background: "var(--background)",
        width: 720,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    setShowProcessingPopup(false);
        try {

          const filesRef = collection(db, `data/${user.email}/public/files/metadata`);
          const querySnapshot = await getDocs(filesRef);
          const new_iterations = parseInt((iterations / 10).toString(), 10);
          const processingMessage = `
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('decrypting-the-file-metadata')}</p>
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>
          `;
          
          // Create the SweetAlert2 popup before the loop
          Swal.fire({
              title: '',
              html: processingMessage,
              color: "var(--foreground)",
              background: "var(--background)",
              width: 720,
              allowOutsideClick: false,
              didOpen: () => {
                  Swal.showLoading();
              }
          });
          
          for (const doc of querySnapshot.docs) {
            fileIndex++;
        
            let title;
            if (i18n.language === "he") {
                // Hebrew version: "מעבד קובץ 1 מתוך 2"
                title = `מעבד קובץ ${fileIndex} מתוך ${querySnapshot.docs.length}`;
            } else {
                // English version: "Processing file 1/2"
                title = `Verarbeite Datei ${fileIndex} von ${querySnapshot.docs.length}`;
            }
        
            Swal.update({ 
                title: title,
                showConfirmButton: false, // Ensure the confirm button remains hidden
            });
            
            // Ensure the loading indicator is still shown after update
            Swal.showLoading();
            //console.log("Container id:", doc.id);

            const [encryptedFileKey, encryptedMetadataKey, encryptedKeyTag] = await getFileKeyContainerById(doc.id);
            
            // Variables to track presence
            const isFileKeyPresent = encryptedFileKey && encryptedFileKey.length > 1;
            const isMetadataKeyPresent = encryptedMetadataKey && encryptedMetadataKey.length > 1;
            const isKeyTagPresent = encryptedKeyTag && encryptedKeyTag.length > 1;
            
            // Declare decrypted keys
            let decryptedFileKey: Uint8Array | null = null;
            let decryptedMetadataKey: Uint8Array | null = null;
            
            // Process the file key
            if (isFileKeyPresent) {
              //console.log('Encrypted File Key:', encryptedFileKey);
              decryptedFileKey = await decryptFieldValueWithTwoCiphersCBC(encryptedFileKey, masterKey, new_iterations);
              //console.log('Decrypted File Key:', decryptedFileKey);
            } else {
              //console.log('Encrypted File Key is missing or invalid.');
            }
            
            // Process the metadata key
            if (isMetadataKeyPresent) {
              //console.log('Encrypted Metadata Key:', encryptedMetadataKey);
              decryptedMetadataKey = await decryptFieldValueWithTwoCiphersCBC(encryptedMetadataKey, masterKey, new_iterations);
              //console.log('Decrypted Metadata Key:', decryptedMetadataKey);
            } else {
              //console.log('Encrypted Metadata Key is missing or invalid.');
            }
            
            // Process the key tag
            if (isKeyTagPresent) {
              //console.log('Encrypted Key Tag:', encryptedKeyTag);
            } else {
              //console.log('Encrypted Key Tag is missing or invalid.');
            }

            if (decryptedFileKey || decryptedMetadataKey) {
              const data = doc.data() as FileData;
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
            
              let keyIntegrity = false;
              if (isFileKeyPresent && isMetadataKeyPresent && isKeyTagPresent && decryptedFileKey && decryptedMetadataKey) {
                const combinedKeyData = new Uint8Array(decryptedFileKey.length + decryptedMetadataKey.length);
                combinedKeyData.set(decryptedFileKey, 0);
                combinedKeyData.set(decryptedMetadataKey, decryptedFileKey.length);
                keyIntegrity = await CheckRecordIntegrity(encryptedKeyTag, masterKey, new_iterations, combinedKeyData);
              }
            
              const metadataIntegrity: boolean = 
                titleIntegrity && titlePaddingValidity && 
                decryptedDescriptionIntegrity && 
                decryptedDescriptionPaddingValidity && keyIntegrity;
            
              const newContainer: Container = {
                id: doc.id,
                title: decryptedFilename,
                color: fileType ? fileType.color : '#3D4785',
                fileSize: `SIZE: ${fileSizeString}`,
                description: decryptedDescription,
                metadataIntegrity
              };

              const newContainerHelper: ContainerHelper = {
                id: doc.id,
                titleIntegrity,
                titlePaddingValidity,
                decryptedDescriptionIntegrity,
                decryptedDescriptionPaddingValidity,
                encryptedTag: data.encryptedTag,
                encryptedLength: data.encryptedLength,
                FileKey: decryptedFileKey ? await uint8ArrayToBase64(decryptedFileKey) : "-1",
                MetadataKey: decryptedMetadataKey ? await uint8ArrayToBase64(decryptedMetadataKey) : "-1",
                keyIntegrity
              };
              
              //console.log(JSON.stringify(newContainer, null, 2));
              //console.log(JSON.stringify(newContainerHelper, null, 2));

              // Update state with the new containers
              setContainers(prevContainers => [...prevContainers, newContainer]);
              setContainerHelpers(prevHelpers => [...prevHelpers, newContainerHelper]);
            } else {            
              const newContainer: Container = {
                id: doc.id,
                title: "Missing Keys",
                color: '#3D4785',
                fileSize: `Size: Irrelevant`,
                description: "Unable to decrypt file metadata",
                metadataIntegrity: false
              };
            
              const newContainerHelper: ContainerHelper = {
                id: doc.id,
                titleIntegrity: false,
                titlePaddingValidity: false,
                decryptedDescriptionIntegrity: false,
                decryptedDescriptionPaddingValidity: false,
                encryptedTag: "-1",
                encryptedLength: 0,
                FileKey: "-1",
                MetadataKey: "-1",
                keyIntegrity: false
              };
            
              // Update state with the new containers
              setContainers(prevContainers => [...prevContainers, newContainer]);
              setContainerHelpers(prevHelpers => [...prevHelpers, newContainerHelper]);
              setShowProcessingPopup(false);
            
              console.log('Container created with missing keys:', doc.id);
            }
          }
          Swal.close();
          SingletonEffect.resetInstance();
        } catch (error) {
          Swal.close();
          console.error('Error fetching file data:', error);
          createNotification('error', "Error", `Error fetching file data: ${error instanceof Error ? error.message : 'Unknown error'}`);
          //toast.error(`Error fetching file data: ${error instanceof Error ? error.message : 'Unknown error'}`);
          /*
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
          });
          */
        } finally {
          Swal.close();
        }
        
        try{
          if (!auth.currentUser) {
            await new Promise(resolve => setTimeout(resolve, 50));
            await show_authentication_error();
            await new Promise(resolve => setTimeout(resolve, 50));
            throw new Error('User not authenticated');
          }
        }
        catch{
  
        }
    };

    const uint8ArrayToBase64 = async (byteArrayToBeConverted: Uint8Array): Promise<string> => {
      // Convert the resulting array to Base64
      const base64Result = btoa(String.fromCharCode(...byteArrayToBeConverted));
      //console.log(randomBytes);
      return base64Result;
    };

    const getFileKeyContainerById = async (recordId: string): Promise<[Uint8Array | null, Uint8Array | null, Uint8Array | null]> => {
      const user = auth.currentUser;
      if (!user){
        return [null, null, null];
      }
      const docRef = doc(db, `data/${user.email}/private/encrypted/files`, recordId);
      const docSnapshot = await getDoc(docRef);
    
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
    
        // Process the fields as needed
        const processField = (field: string): Uint8Array => {
          if (!data[field] || typeof data[field] !== 'string') {
            console.warn(`Invalid or missing ${field} for document ${docSnapshot.id}`);
            return new Uint8Array([1]); // Return a default value if invalid
          }
          const decoded = base64ToUint8Array(data[field]);
          return decoded.length % 16 === 0 ? decoded : new Uint8Array([1]); // Ensure length is a multiple of 16
        };
    
        // Return the three values as an array
        return [
          processField('encryptedFileKey'),
          processField('encryptedMetadataKey'),
          processField('encryptedKeyTag')
        ];
      } else {
        console.error('No such document!');
        return [null, null, null]; // Return nulls if the document does not exist
      }
    };
    

    const decryptFieldValueWithTwoCiphersCBC = async (
      bytes: Uint8Array, 
      password: Uint8Array, 
      iterations: number
    ): Promise<Uint8Array> => {
      const chunkSize = 16;
      const salt = bytes.slice(0, 32);
      const derivedKey = await deriveBytesUsingArgon2id(password, salt, iterations, 224);
      let chacha20key = new Uint8Array(derivedKey.slice(0, 64));
      const blockCipherKey = derivedKey.slice(64, 96);
    
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
    
    const calculateColumns = () => {
        const containerWidth = window.innerWidth - (24 * 2); // Subtract left and right padding
        const itemWidth = 352; // Width of each item
        const gap = 36; // Gap between items

        const totalWidth = itemWidth + gap; // Width of one item including gap
        const cols = Math.floor(containerWidth / totalWidth); // Calculate number of columns

        //console.log(cols);
        //console.log(window.innerWidth);
        
        setColumns(cols > 0 ? cols : 1); // Ensure at least one column
    };

    useEffect(() => {
        calculateColumns(); // Calculate on mount
        
        window.addEventListener('resize', calculateColumns); // Add resize event listener
        
        return () => window.removeEventListener('resize', calculateColumns); // Cleanup listener on unmount
    }, []);

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
      const derivedKey = await deriveBytesUsingArgon2id(password, salt, iterations, 224);
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

  const encryptPrivateRecordTagWithTwoCiphersCBC = async (
    bytes: Uint8Array,
    password: Uint8Array,
    iterations: number,
): Promise<Uint8Array> => {
    const chunkSize = 256 * 1024; // 256 KB chunks
    let offset = 0;
    const salt = window.crypto.getRandomValues(new Uint8Array(32));
    const encryptedChunks: Uint8Array[] = [];
    encryptedChunks.push(salt);
    const derivedKey = await deriveBytesUsingArgon2id(password, salt, iterations, 224);
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

  const CheckRecordIntegrity = async (
    bytes: Uint8Array, 
    password: Uint8Array, 
    iterations: number,
    plaintextToVerify: Uint8Array
  ): Promise<boolean> => {
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

    const handleFilesAdded = async (files: File[]) => {
        const nonEmptyFiles = Array.from(files).filter(file => {
            if (file.size === 0) {
              //toast.error(`The "${file.name}" file was excluded from the encryption queue. The file can't be empty.`);
              createNotification('error', "Error", `The "${file.name}" file was excluded from the encryption queue. The file can't be empty.`);
              return false;
            }
            if (file.size > 10 * 1024 * 1024) { // 10 MB in bytes
              //toast.error(`The "${file.name}" file was excluded from the encryption queue. The file size can't exceed 10 MB.`);
              createNotification('error', "Error", `The "${file.name}" file was excluded from the encryption queue. The file size can't exceed 10 MB.`);

              return false;
            }
            return true;
          });
        
          for (let i = 0; i < nonEmptyFiles.length; i++) {
            setShowProcessingPopup(true);
            const file = nonEmptyFiles[i];
            setCurrentFileName(file.name);
            setProcessingProgress(0);
            setProcessingStep(t('reading-file'));
            setProcessingStepDescription(t('please_wait'));
            await new Promise(resolve => setTimeout(resolve, 50));
            try {
              const fileBytes = await readFileByChunks(file);

              const FileKey =  await generateRandomBase64String(208);
              const fileKeyArray = base64ToUint8Array(FileKey);

              const MetadataKey =  await generateRandomBase64String(128);
              const metadataKeyArraySource = base64ToUint8Array(MetadataKey);
              const metadataKeyArray = await deriveBytesUsingArgon2id(
                metadataKeyArraySource.slice(26), 
                metadataKeyArraySource.slice(0, 26), 
                14, 
                350
              );
              
              const [encryptedData, tag, recordKey] = await encryptFileWithTwoCiphersCBC(fileBytes, fileKeyArray, 100);
              
              const userWantsDescription = await showDescriptionPopup(file.name);
              let description: Uint8Array;
        
              if (userWantsDescription) {
                const userDescription = await getUserDescription(file.name);
                description = new TextEncoder().encode(userDescription.trim() === "" ? 'No description.' : userDescription);
              } else {
                description = new TextEncoder().encode('No description.');
              }
        
              // Encode filename
              const filenameBytes = new TextEncoder().encode(file.name);
              
              toggleProgressAnimation(true);
              setProcessingStep(t('encrypting-filename'));
              setProcessingStepDescription(t('please_wait'));
              const encryptedFilename = await encryptDataWithTwoCiphersCBC(filenameBytes, metadataKeyArray.slice(0, 175), 50);
              let encryptedDescription;
              if (new TextDecoder().decode(description) !== 'No description.') {
                  toggleProgressAnimation(true);
                  setProcessingStep(t('encrypting-description'));
                  encryptedDescription = await encryptDataWithTwoCiphersCBC(description, metadataKeyArray.slice(175), 50);
              } else {
                  encryptedDescription = new TextEncoder().encode('No description.');
              }

              setProcessingStep(t('encrypting-key'));
              setProcessingStepDescription(t('please_wait'));
              const combinedData = new Uint8Array(filenameBytes.length + description.length + tag.length);
              combinedData.set(filenameBytes, 0);
              combinedData.set(description, filenameBytes.length);
              combinedData.set(tag, filenameBytes.length + description.length);
              const encryptedTag = await encryptRecordTagWithTwoCiphersCBC(combinedData, recordKey);

              const new_iterations = parseInt((iterations / 10).toString(), 10);
              const encryptedFileKey = await encryptFieldValueWithTwoCiphersCBC(fileKeyArray, masterKey, new_iterations);
              const encryptedMetadataKey = await encryptFieldValueWithTwoCiphersCBC(metadataKeyArraySource, masterKey, new_iterations);
              // Create a combined tag for the record
              const combinedKeyData = new Uint8Array(fileKeyArray.length + metadataKeyArraySource.length);
              combinedKeyData.set(fileKeyArray, 0);
              combinedKeyData.set(metadataKeyArraySource, fileKeyArray.length);
              const encryptedKeyTag = await encryptPrivateRecordTagWithTwoCiphersCBC(combinedKeyData, masterKey, new_iterations);
              /*              
              console.log("Encrypted File Content:", encryptedData);
              console.log("Encrypted Filename:", encryptedFilename);
              console.log("Encrypted Description:", encryptedDescription);
              console.log("Encrypted Record Tag:", encryptedTag);
              console.log("File size:", file.size);
              console.log("File Key:", fileKeyArray);
              console.log("Metadata Key:", metadataKeyArraySource);
              console.log("File Key:", FileKey);
              console.log("Metadata Key:", MetadataKey);
              console.log("Encrypted File Key:", encryptedFileKey);
              console.log("Encrypted Metadata Key:", encryptedMetadataKey);
              console.log("Encrypted Key Tag:", encryptedKeyTag);
              console.log("Key Integrity:", await CheckRecordIntegrity(encryptedKeyTag, masterKey, new_iterations, combinedKeyData));
              */
              await uploadFile(encryptedData, encryptedFilename, encryptedDescription, encryptedTag, file.size, file.name, new TextDecoder().decode(description), FileKey, MetadataKey, encryptedFileKey, encryptedMetadataKey, encryptedKeyTag);
            } catch (error) {
              //toast.error(`Error processing the "${file.name}" file. Check the console for more information.`);
              console.error(`Error processing file ${file.name}:`, error);
              createNotification('error', "Error", `Error processing the "${file.name}" file. Check the console for more information.`);
              /*
              const errorMessage = `
              <p style="margin-bottom: 10px;">Error processing the "${file.name}" file:</p>
              <p>${error instanceof Error ? error.message : 'Unknown error'}</p>`;
          
              // Show the Swal alert with the error message
              Swal.fire({
                icon: "error",
                title: t('error_inscription'), // Use the original translation key for the title
                html: errorMessage,
                width: 600,
                padding: "3em",
                color: "var(--foreground)",
                background: "var(--background)",
                confirmButtonText: t('ok_button'), // Use the original translation key for the button text
                confirmButtonColor: "var(--firstThemeColor)"
              });
              */
            }
          }
          
          //setShowProcessingPopup(false);
        };

        const uploadFile = async (
          encryptedData: Uint8Array,
          encryptedFilename: Uint8Array,
          encryptedDescription: Uint8Array,
          encryptedTag: Uint8Array,
          fileSize: number,
          unencryptedFilename: string,
          unencryptedDescription: string,
          FileKey: string,
          MetadataKey: string,
          encryptedFileKey: Uint8Array,
          encryptedMetadataKey: Uint8Array,
          encryptedKeyTag: Uint8Array,
        ): Promise<void> => {
          try {
            const user = auth.currentUser;
            if (!user) {
              await new Promise(resolve => setTimeout(resolve, 25));
              await show_authentication_error();
              throw new Error('User not authenticated');
            }
        
            setProcessingStep(t('preparing-for-file-upload'));
            setProcessingStepDescription(t('please_wait'));
            toggleProgressAnimation(true);
        
            let uniqueId: string = '';
            let isUnique = false;
            while (!isUnique) {
              uniqueId = generateUniqueId();
              const docRef = doc(db, `data/${user.email}/public/files/metadata`, uniqueId);
              const docSnap = await getDoc(docRef);
              isUnique = !docSnap.exists();
            }
        
            const updateProgressWithDelay = async (progress: number) => {
              setProcessingProgress(progress);
              await new Promise(resolve => setTimeout(resolve, 10));
            };
        
            const chunkSize = 16 * 1024;
            const totalChunks = Math.ceil(encryptedData.length / chunkSize);
        
            setProcessingStep(t('uploading-the-file-to-the-cloud'));
            setProcessingStepDescription(t('please-be-patient-this-can-take-a-while'));
            setShowProcessingPopup(true);
            toggleProgressAnimation(false);
            await updateProgressWithDelay(0);
        
            for (let i = 0; i < totalChunks; i++) {
              const start = i * chunkSize;
              const end = Math.min(start + chunkSize, encryptedData.length);
              const chunk = encryptedData.slice(start, end);
              
              const chunkB64 = btoa(String.fromCharCode(...chunk));
              
              await setDoc(doc(db, `data/${user.email}/public/files/${uniqueId}`, `${i}`), {
                data: chunkB64
              });
        
              const progress = parseFloat(((i + 1) / totalChunks * 100).toFixed(2));
              
              if (progress === 100) {
                setProcessingStep(t('wrapping-up-the-upload'));
                setProcessingStepDescription(t('that-shouldnt-take-long'));
              } else {
                setProcessingStep(t('uploading-the-file-to-the-cloud'));
                setProcessingStepDescription(t('please-be-patient-this-can-take-a-while'));
              }
        
              await updateProgressWithDelay(progress);
            }
        
            // Create record data with encryptedLength
            btoa(String.fromCharCode(...encryptedFilename))
            const recordData = {
              encryptedFilename: btoa(String.fromCharCode(...encryptedFilename)),
              encryptedDescription: btoa(String.fromCharCode(...encryptedDescription)),
              encryptedTag: btoa(String.fromCharCode(...encryptedTag)),
              fileSize: fileSize,
              encryptedLength: encryptedData.length // Add the encrypted length here
            };
        
            await setDoc(doc(db, `data/${user.email}/public/files/metadata`, uniqueId), recordData);
        
            // File size and type logic
            const fileSizeString = generateFileSizeString(fileSize);
            const extension = unencryptedFilename.split('.').pop() || '';
            const fileType = fileTypeClassification.find(type => type.extensions.includes(`.${extension}`));
        
            // Create new container for UI
            const newContainer: Container = {
              id: uniqueId,
              title: unencryptedFilename,
              color: fileType ? fileType.color : '#3D4785',
              fileSize: `SIZE: ${fileSizeString}`,
              description: unencryptedDescription,
              metadataIntegrity: true
            };

            const newContainerHelper: ContainerHelper = {
              id: uniqueId,
              titleIntegrity: true,
              titlePaddingValidity: true,
              decryptedDescriptionIntegrity: true,
              decryptedDescriptionPaddingValidity: true,
              encryptedTag: btoa(String.fromCharCode(...encryptedTag)),
              encryptedLength: encryptedData.length,
              FileKey,
              MetadataKey,
              keyIntegrity: true,
            };

            await setDoc(doc(db, `data/${user.email}/private/encrypted/files/${uniqueId}`), {
              encryptedFileKey: btoa(String.fromCharCode(...encryptedFileKey)),
              encryptedMetadataKey: btoa(String.fromCharCode(...encryptedMetadataKey)),
              encryptedKeyTag: btoa(String.fromCharCode(...encryptedKeyTag)),
          });

            //toast.success('File uploaded successfully!');
            createNotification('success', unencryptedFilename, 'File uploaded successfully!');
            setContainers(prevContainers => [...prevContainers, newContainer]);
            setContainerHelpers(prevHelpers => [...prevHelpers, newContainerHelper]);
        
            setShowProcessingPopup(false);
        
          } catch (error) {
        
            if (error instanceof Error && error.message === 'User not authenticated') {
              setShowProcessingPopup(false);
              await new Promise(resolve => setTimeout(resolve, 50));
              await show_authentication_error();
              
              // Create a promise that never resolves
              await new Promise(() => {});
            } else {
              // For other errors, show the error message and close the processing popup
              console.error('Error uploading the "', unencryptedFilename, '" file to the cloud:', error); // Log the error to the console
              const notificationMessage = `Failed to upload the "${unencryptedFilename}" file to the cloud: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
            
            // Show the notification
            createNotification('error', 'Error', notificationMessage);
            /*
              // Create the error message to display in Swal
              const errorMessage = `
                  <p style="margin-bottom: 10px;">Error uploading the "${unencryptedFilename}" file to the cloud:</p>
                  <p>${error instanceof Error ? error.message : 'Unknown error occurred'}</p>`;
            
              // Show the Swal alert with the error message
              Swal.fire({
                icon: "error",
                title: t('error_inscription'), // Use the original translation key for the title
                html: errorMessage,
                width: 600,
                padding: "3em",
                color: "var(--foreground)",
                background: "var(--background)",
                confirmButtonText: t('ok_button'), // Use the original translation key for the button text
                confirmButtonColor: "var(--firstThemeColor)"
              });
              */
              setShowProcessingPopup(false); // Close the processing popup
            }
          }
        };

        const generateUniqueId = () => {
          const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          const randomValues = window.crypto.getRandomValues(new Uint8Array(10));
          return Array.from(randomValues, (byte) => charset[byte % charset.length]).join('');
        };

        const showDescriptionPopup = useCallback((fileName: string): Promise<boolean> => {
            return new Promise((resolve) => {
              setDescriptionPopup(
                <DescriptionPopup
                  message={`The file "${fileName}" has been encrypted successfully.`}
                  message2={t('would-you-like-to-add-a-description-to-the-file')}
                  onYes={() => {
                    setDescriptionPopup(null);
                    resolve(true);
                  }}
                  onNo={() => {
                    setDescriptionPopup(null);
                    resolve(false);
                  }}
                />
              );
            });
          }, []);

          const getUserDescription = useCallback((fileName: string): Promise<string> => {
            return new Promise((resolve) => {
              setDescriptionPopup(
                <DescriptionInputPopup
                message={`Enter description for the "${fileName}" file:`}
                  onSubmit={(description: string) => {
                    setDescriptionPopup(null);
                    resolve(description);
                  }}
                  onCancel={() => {
                    setDescriptionPopup(null);
                    resolve("");
                  }}
                />
              );
            });
          }, []);

        const encryptDataWithTwoCiphersCBC = async (
            bytes: Uint8Array,
            password: Uint8Array,
            iterations: number,
          ): Promise<Uint8Array> => {
            const chunkSize = 256 * 1024; // 256 KB chunks
            let offset = 0;
            const salt = window.crypto.getRandomValues(new Uint8Array(32));
            const encryptedChunks: Uint8Array[] = [];
            encryptedChunks.push(salt);
            const derivedKey = await deriveBytesUsingArgon2id(password, salt, iterations, 224);
            let chacha20key = new Uint8Array(derivedKey.slice(0, 64));
            const blockCipherKey = derivedKey.slice(64, 96);
            const hmacKey = derivedKey.slice(96);
            const tag = await computeTagForRecordUsingHMACSHA512(hmacKey, bytes);
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

        const computeTagForFileUsingHMACSHA512 = useCallback(async (key: Uint8Array, data: Uint8Array) => {
            toggleProgressAnimation(false);
            setProcessingStep(t('computing-tag-for-file-using-hmac-sha512'));
            setProcessingStepDescription(t('please_wait'));
            await new Promise(resolve => setTimeout(resolve, 10));
            const chunkSize = 256 * 1024; // 256 KB chunks
            let offset = 0;
            const hmac = await createHMAC(createSHA512(), key);
            hmac.init();
          
            async function updateProgressWithDelay(progress: number) {
              setProcessingProgress(progress);
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          
            while (offset < data.length) {
              const chunk = data.slice(offset, Math.min(offset + chunkSize, data.length));
              hmac.update(chunk);
              offset += chunk.length;
          
              const progress = (offset / data.length) * 100;
              await updateProgressWithDelay(progress);
            }
            await new Promise(resolve => setTimeout(resolve, 20));
            setProcessingProgress(100);
            setProcessingStep(t('finalizing-tag-computation'));
            await new Promise(resolve => setTimeout(resolve, 20));
            toggleProgressAnimation(true);
            await new Promise(resolve => setTimeout(resolve, 20));
            const signature = hmac.digest('binary');
            return new Uint8Array(signature);
          }, []);

        const encryptFileWithTwoCiphersCBC = async (
            bytes: Uint8Array,
            password: Uint8Array,
            iterations: number
          ): Promise<[Uint8Array, Uint8Array, Uint8Array]> => {
            const salt = window.crypto.getRandomValues(new Uint8Array(32));
            const encryptedChunks: Uint8Array[] = [];
            encryptedChunks.push(salt);
            toggleProgressAnimation(true);
            //setProcessingStep('Deriving file encryption key using Argon2id');
            //setProcessingStepDescription('The page might freeze or become unresponsive during the process');
            const derivedKey = await deriveBytesUsingArgon2id(password, salt, iterations, 416);
            const chunkSize = 256 * 1024; // 256 KB chunks
            let offset = 0;
            let chacha20key = new Uint8Array(derivedKey.slice(0, 64));
            const blockCipherKey = derivedKey.slice(64, 96);
            const hmacKey = derivedKey.slice(96, 224);
            const tag = await computeTagForFileUsingHMACSHA512(hmacKey, bytes);
            setProcessingStep(t('preparing-for-file-encryption'));
            await new Promise(resolve => setTimeout(resolve, 10));
            const tag_and_data = new Uint8Array(tag.length + bytes.length);
            tag_and_data.set(tag, 0);
            tag_and_data.set(bytes, tag.length);

            const encryptedData = new Uint8Array(tag_and_data.length);
            toggleProgressAnimation(false);
            setProcessingStep(t('encryption-step1'));
            const updateProgressWithDelay = async (progress: number) => {
              setProcessingProgress(progress);
              await new Promise(resolve => setTimeout(resolve, 10));
            };
          
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
              const progress = (offset / totalSize) * 100;
              await updateProgressWithDelay(progress);
            }
        
            const blockcipher_chunk_size = 16;
            const iv = window.crypto.getRandomValues(new Uint8Array(16));
            const encryptedIV = await encryptSerpent256ECB(iv, blockCipherKey);
            encryptedChunks.push(encryptedIV);
            toggleProgressAnimation(false);
            setProcessingStep(t('encryption-step2'));
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
              if (i % 16000 === 0) {
                await updateProgressWithDelay((i / encryptedData.length) * 100);
              }
            }
          
            await updateProgressWithDelay(100);
            setProcessingStep(t('encryption-done'));
            await new Promise(resolve => setTimeout(resolve, 700));
            setProcessingStepDescription('');
            const totalLength = encryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const result = new Uint8Array(totalLength);
            let soffset = 0;
            for (const chunk of encryptedChunks) {
              result.set(chunk, soffset);
              soffset += chunk.length;
            }
          
            return [result, tag, derivedKey.slice(224)];
          }

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
        
          const encryptRecordTagWithTwoCiphersCBC = async (
            bytes: Uint8Array,
            derivedKey: Uint8Array
          ): Promise<Uint8Array> => {
            const chunkSize = 256 * 1024; // 256 KB chunks
            let offset = 0;
            const encryptedChunks: Uint8Array[] = [];
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

        const readFileByChunks = async (file: File): Promise<Uint8Array> => {
            const chunkSize = 1024 * 1024; // 1MB chunks
            const reader = new FileReader();
            let offset = 0;
            const totalSize = file.size;
            const fileBytes = new Uint8Array(totalSize);
          
            const readChunk = (blob: Blob): Promise<ArrayBuffer> => {
              return new Promise((resolve, reject) => {
                reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
                reader.onerror = (e) => reject(e.target?.error);
                reader.readAsArrayBuffer(blob);
              });
            };
          
            const updateProgressWithDelay = async (progress: number) => {
              setProcessingProgress(progress);
              await new Promise(resolve => setTimeout(resolve, 10));
            };
          
            while (offset < totalSize) {
              const chunk = file.slice(offset, offset + chunkSize);
              const arrayBuffer = await readChunk(chunk);
              const uint8Array = new Uint8Array(arrayBuffer);
              fileBytes.set(uint8Array, offset);
              offset += uint8Array.length;
              const progress = ((offset / totalSize) * 100).toFixed(2);
              await updateProgressWithDelay(parseFloat(progress));
            }
          
            return fileBytes;
          };
          
    const show_authentication_error = async () =>{
      
      const warningMessage = `
        <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('authentication-error-line1')}</p>
        <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('authentication-error-line2')}</p>
      `;
      
      Swal.fire({
        icon: "error",
        title: t('authentication-error-top'),
        html: warningMessage, // Use the formatted warning message
        width: i18n.language === 'he' ? 600 : 720,
        padding: "3em",
        color: "var(--foreground)",
        background: "var(--background)",
        confirmButtonText: t('ok_button'),
        confirmButtonColor: "var(--firstThemeColor)",
      });
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const handleGetTag = async (id: string) => {
      const user = auth.currentUser;
      if (!user) {
        await show_authentication_error();
        return;
      }
      const userEmail = user.email; // Make sure you have access to the user object
      
      if (!userEmail)
        return;
      // Remove the domain from the user's email
      const localPart = userEmail.split('@')[0]; // Get everything before the '@'
  
      const containerHelper = containerHelpers.find(helper => helper.id === id);
      const container = containers.find(c => c.id === id);
  
      if (containerHelper && container) {
        const { MetadataKey, FileKey } = containerHelper;
        const tag = `${localPart},${id},${MetadataKey},${FileKey}`;
  
        setPopupData({
          id,
          title: container.title,
          color: container.color,
          fileSize: container.fileSize,
          fileTag: tag
        });
  
        setShowTagPopup(true);
      } else {
        console.log('Container or helper not found for ID:', id);
      }
    };
  
    const handleCloseTagPopup = useCallback(() => {
      setShowTagPopup(false);
      setPopupData(null);
    }, []);
  

    const handleOptionsClick = async (id: string) => {
      const user = auth.currentUser;
      if (!user) {
          await show_authentication_error();
          return;
      }
  
      // Find the container by ID
      const container = containers.find(c => c.id === id);
  
      if (container) {
          // Prepare data for FileOptions
          const formattedDescription = container.description === "No description." 
              ? "No description." 
              : `Description: ${container.description}`; // Only add "Description: " if applicable
  
          setFileOptionsData({
              id: container.id,
              title: container.title,
              color: container.color,
              fileSize: container.fileSize,
              fullDescription: formattedDescription, // Use formatted description here
          });
          setShowFileOptions(true); // Show the FileOptions pop-up
      } else {
          console.log(`No container found with id:${id}`);
      }
    };

    const handleDownload = async () => {
      const id =  fileOptionsData?.id;
        if (!id)
          return;
        const user = auth.currentUser;
        if (!user) {
          await show_authentication_error();
          return;
        }
        const userEmail = user.email;
        
        if (!userEmail)
          return;
        // Remove the domain from the user's email
        const localPart = userEmail.split('@')[0]; // Get everything before the '@'

        const containerHelper = containerHelpers.find(helper => helper.id === id);
        const container = containers.find(c => c.id === id);

        if (containerHelper && container) {
          const { MetadataKey, FileKey } = containerHelper;
          const tag = `${localPart},${id},${MetadataKey},${FileKey}`;

          handleCloseFileOptions();
          //console.log(tag);
          if(containerHelper.keyIntegrity === true){
            setFileTagForDownloader(tag);
            downloaderRef.current?.initiateDownload?.();
          }
          else{
            const result = await Swal.fire({
              title: container?.title || '',
              html: `
                <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('key-integrity-is-compromised')}</p>
                <p dir="${isRTL ? 'rtl' : 'ltr'}">${t('would-you-like-to-continue-anyway')}</p>
              `,
              icon: "warning",
              showCancelButton: true,
              confirmButtonText: t('yes'),
              cancelButtonText: t('no'),
              reverseButtons: isRTL,
              width: 640,
              padding: "3em",
              color: "var(--foreground)",
              background: "var(--background)",
              cancelButtonColor: "var(--generalErrorColor)",
              confirmButtonColor: "var(--firstThemeColor)"
            });
          
            if (result.isConfirmed) {
              setFileTagForDownloader(tag);
              downloaderRef.current?.initiateDownload?.();
            }
            
          }
        } else {
          console.log('Container or helper not found for ID:', id);
        }
    };
  
    const handleDownloadComplete = useCallback(() => {
      setFileTagForDownloader(null);
    }, []);

    const handleGetTagFromAllOptions = async () => {
        const id =  fileOptionsData?.id;
        if (!id)
          return;
        const user = auth.currentUser;
        if (!user) {
          await show_authentication_error();
          return;
        }
        const userEmail = user.email; // Make sure you have access to the user object
        
        if (!userEmail)
          return;
        // Remove the domain from the user's email
        const localPart = userEmail.split('@')[0]; // Get everything before the '@'

        const containerHelper = containerHelpers.find(helper => helper.id === id);
        const container = containers.find(c => c.id === id);

        if (containerHelper && container) {
          const { MetadataKey, FileKey } = containerHelper;
          const tag = `${localPart},${id},${MetadataKey},${FileKey}`;

          setPopupData({
            id,
            title: container.title,
            color: container.color,
            fileSize: container.fileSize,
            fileTag: tag
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
        const user = auth.currentUser;
        if (!user) {
          await show_authentication_error();
          return;
        }
        const userEmail = user.email;
        
        if (!userEmail)
          return;
        // Remove the domain from the user's email
        const localPart = userEmail.split('@')[0]; // Get everything before the '@'

        const containerHelper = containerHelpers.find(helper => helper.id === id);
        const container = containers.find(c => c.id === id);

        if (containerHelper && container) {
          const { MetadataKey, FileKey } = containerHelper;
          const tag = `${localPart},${id},${MetadataKey},${FileKey}`;

          handleCloseFileOptions();
          //console.log(tag);
          if(containerHelper.keyIntegrity === true){
            if (container) {
      
              setSendFileData({
                  title: container.title,
                  color: container.color,
                  fileSize: container.fileSize,
                  tag
              });
              setShowSendFile(true);
            } else {
                console.log(`No container found with id:${id}`);
            }
          }
          else{
            const result = await Swal.fire({
              title: container?.title || '',
              html: `
                <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('key-integrity-is-compromised')}</p>
                <p dir="${isRTL ? 'rtl' : 'ltr'}">${t('would-you-like-to-continue-anyway')}</p>
              `,
              icon: "warning",
              showCancelButton: true,
              confirmButtonText: t('yes'),
              cancelButtonText: t('no'),
              reverseButtons: isRTL,
              width: 640,
              padding: "3em",
              color: "var(--foreground)",
              background: "var(--background)",
              cancelButtonColor: "var(--generalErrorColor)",
              confirmButtonColor: "var(--firstThemeColor)"
            });
          
            if (result.isConfirmed) {
              if (container) {
      
                setSendFileData({
                    title: container.title,
                    color: container.color,
                    fileSize: container.fileSize,
                    tag
                });
                setShowSendFile(true);
              } else {
                  console.log(`No container found with id:${id}`);
              }
            }
            
          }
        } else {
          console.log('Container or helper not found for ID:', id);
        }
    };

    const handleDelete = async () => {
      const result = await Swal.fire({
        title: fileOptionsData?.title || '',
        html: `
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('delete_file_confirmation')}</p>
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
        console.log(`Deleting ${fileOptionsData?.title}`);
        // Add your delete logic here
        await deleteRecord(fileOptionsData!.id, fileOptionsData!.title);
      }
      
      handleCloseFileOptions(); // Close after deletion confirmation, regardless of the choice
    };

    const deleteCollection = async (containerId: string, totalChunks: number) => {
      const batchSize = 10; // Number of deletes per batch
      let batch = writeBatch(db);
      let deletedChunks = 0;
    
      for (let chunkNumber = 0; chunkNumber < totalChunks; chunkNumber++) {
        const chunkRef = doc(db, `data/${auth.currentUser?.email}/public/files/${containerId}`, `${chunkNumber}`);
        //console.log(`Preparing to delete chunk document: ${chunkRef.path}`);
        batch.delete(chunkRef);
    
        if ((chunkNumber + 1) % batchSize === 0) {
          try {
            await batch.commit();
            deletedChunks += batchSize;
            const progress = (deletedChunks / totalChunks) * 100;

            // Constructing the processing message with proper template literals
            const processingMessage = `
                <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('deleting-file')}</p>
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
          } catch (error) {
            console.error('Error committing batch deletion:', error);
          }
          batch = writeBatch(db);
        }
      }
    
      if (totalChunks % batchSize !== 0) {
        try {
          await batch.commit();
          deletedChunks += totalChunks % batchSize;
          const progress = (deletedChunks / totalChunks) * 100;

          // Constructing the processing message with proper template literals
          const processingMessage = `
              <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('deleting-file')}</p>
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
          //console.log(`Final batch deletion committed successfully for remaining chunks. Progress: ${progress.toFixed(2)}%`);
        } catch (error) {
          console.error('Error committing final batch deletion:', error);
        }
      }
      //console.log('All chunks deleted successfully.');
    };
    
    const deleteRecord = async (selectedRecordId: string, filename: string) => {
      if (selectedRecordId) {
        try {
          const user = auth.currentUser;
          if (!user) {
            await new Promise(resolve => setTimeout(resolve, 50));
            await show_authentication_error();
            return;
          }
    
          const containerId = selectedRecordId;
          const containerHelper = containerHelpers.find(helper => helper.id === containerId);
          
          if (!containerHelper) {
            throw new Error('ContainerHelper not found for the given container ID');
          }
      
          const encryptedLength = containerHelper.encryptedLength;
      
          if (typeof encryptedLength !== 'number') {
            await new Promise(resolve => setTimeout(resolve, 75));
            console.warn('Invalid or unknown encryptedLength value. Deleting all elements in the collection.');
            let processingMessage = `
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('broken-metadata-detected')}</p>
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('deleting-file-using-collection-reference')}</p>
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please-be-patient-this-can-take-a-while')}</p>
            `;
            Swal.fire({
              title: filename,
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
            Swal.showLoading();
            await new Promise(resolve => setTimeout(resolve, 75));
            // Reference to the collection
            const collectionRef = collection(db, `data/${user.email}/public/files/${containerId}`);
            
            // Fetch all documents in the collection
            const querySnapshot = await getDocs(collectionRef);
            
            // Delete each document in the collection
            const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
          
            processingMessage = `
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('deleting-metadata')}</p>
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>
            `;
            Swal.update({ 
                html: processingMessage,
                showConfirmButton: false,
            });
            Swal.showLoading();
            const batch = writeBatch(db);
            const chunkRef = doc(db, `data/${auth.currentUser?.email}/public/files/metadata`, `${containerId}`);
            //console.log(`Preparing to delete chunk document: ${chunkRef.path}`);
            batch.delete(chunkRef);
            await batch.commit();
            processingMessage = `
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('deleting-file-key')}</p>
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>
            `;
            Swal.update({ 
                html: processingMessage,
                showConfirmButton: false,
            });
            Swal.showLoading();
            const batch1 = writeBatch(db);
            const chunkRef1 = doc(db, `data/${auth.currentUser?.email}/private/encrypted/files`, `${containerId}`);
            //console.log(`Preparing to delete chunk document: ${chunkRef.path}`);
            batch1.delete(chunkRef1);
            await batch1.commit();
            
            setContainers(prevContainers => prevContainers.filter(c => c.id !== containerId));
            setContainerHelpers(prevContainers => prevContainers.filter(c => c.id !== containerId));
            //toast.success('File with broken metadata deleted successfully!');
            await new Promise(resolve => setTimeout(resolve, 75));
            Swal.fire({
              icon: "success",
              title: t('file-deleted-successfully-top'), // Adjust translation key as needed
              width: 720,
              padding: "3em",
              color: "var(--foreground)",
              background: "var(--background)",
              confirmButtonText: t('ok_button'),
              confirmButtonColor: "var(--firstThemeColor)"
            });
            await new Promise(resolve => setTimeout(resolve, 75));
            return; // Exit early after deletion
          }
          const container = containers.find(c => c.id === containerId);
          if (!container) {
            throw new Error('Container not found');
          }
          let processingMessage = `
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('deleting-file')}</p>
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>
          `;
          Swal.fire({
            title: filename,
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
      
          const chunkSize = 16 * 1024;
          const totalChunks = Math.ceil(encryptedLength / chunkSize);
          
          //console.log(`Total chunks to delete: ${totalChunks}`);
      
          await deleteCollection(containerId, totalChunks);
      
          processingMessage = `
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('deleting-metadata')}</p>
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>
          `;
          Swal.update({ 
              html: processingMessage,
              showConfirmButton: false,
          });
          Swal.showLoading();
          const batch = writeBatch(db);
          const chunkRef = doc(db, `data/${auth.currentUser?.email}/public/files/metadata`, `${containerId}`);
          //console.log(`Preparing to delete chunk document: ${chunkRef.path}`);
          batch.delete(chunkRef);
          await batch.commit();
          processingMessage = `
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('deleting-file-key')}</p>
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>
          `;
          Swal.update({ 
              html: processingMessage,
              showConfirmButton: false,
          });
          Swal.showLoading();
          const batch1 = writeBatch(db);
          const chunkRef1 = doc(db, `data/${auth.currentUser?.email}/private/encrypted/files`, `${containerId}`);
          //console.log(`Preparing to delete chunk document: ${chunkRef.path}`);
          batch1.delete(chunkRef1);
          await batch1.commit();

          setContainers(prevContainers => prevContainers.filter(c => c.id !== containerId));
          setContainerHelpers(prevContainers => prevContainers.filter(c => c.id !== containerId));
          await new Promise(resolve => setTimeout(resolve, 75));
          Swal.fire({
            icon: "success",
            title: t('file-deleted-successfully-top'), // Adjust translation key as needed
            width: 720,
            padding: "3em",
            color: "var(--foreground)",
            background: "var(--background)",
            confirmButtonText: t('ok_button'),
            confirmButtonColor: "var(--firstThemeColor)"
          });
          await new Promise(resolve => setTimeout(resolve, 75));
          //toast.success('File deleted successfully!');
        } catch (error) {
        
          if (error instanceof Error && error.message === 'User not authenticated') {
            setShowProcessingPopup(false);
            await new Promise(resolve => setTimeout(resolve, 50));
            await show_authentication_error();
            
            // Create a promise that never resolves
            await new Promise(() => {});
          } else {
            // For other errors, show the error message and close the processing popup
            console.error('Error deleting the "', filename, '" file from the firebase:', error); // Log the error to the console

            const warningMessage = `
              <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('failed-to-delete-file')}</p>
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
      }
    };

    const handleCloseFileOptions = () => {
        setShowFileOptions(false);
        setFileOptionsData(null);
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
    
      const generateRandomBase64String = async (howManyBytes: number): Promise<string> => {
        // Generate a random size between 1200 and 1600
        const randomSize = Math.floor(Math.random() * (1600 - 1200 + 1)) + 1200;
    
        // Generate a random value for slicing between 40 and 100
        const sliceSize = Math.floor(Math.random() * (100 - 40 + 1)) + 40;
    
        const randomBytesCrypto = new Uint8Array(randomSize);
        window.crypto.getRandomValues(randomBytesCrypto);
    
        const randomBytes = await deriveBytesUsingArgon2id(
          randomBytesCrypto.slice(sliceSize), 
          randomBytesCrypto.slice(0, sliceSize), 
          10, 
          howManyBytes
        );
    
        // Convert the resulting array to Base64
        const base64Result = btoa(String.fromCharCode(...randomBytes));
        //console.log(randomBytes);
        return base64Result;
      };
    
      // Function to convert Base64 string to Uint8Array
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

    // BentoGrid Component

    const BentoGrid = ({ className, children, style }: { className?: string; children?: React.ReactNode; style?: React.CSSProperties }) => {
      const { i18n } = useTranslation();
    
      const combinedStyle: React.CSSProperties = {
        ...style,
        transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none',
      };
    
      return (
        <div className={`grid gap-[36px] mx-auto ${className}`} style={combinedStyle}>
          {children}
        </div>
      );
    };

    // BentoGridItem Component
    const BentoGridItem = ({ children }: { children?: React.ReactNode }) => {
      const { i18n } = useTranslation();
    
      const itemStyle: React.CSSProperties = {
        width: "352px",
        height: "352px",
        transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none',
      };
    
      return (
        <div className="flex justify-center items-center" style={itemStyle}>
          {children}
        </div>
      );
    };

    const toggleProgressAnimation = (isAnimating: boolean) => {
      const container = progressContainerRef.current;
      if (!container) return;
    
      if (isAnimating) {
        container.innerHTML = `
          <style>
            @keyframes moveBar {
              0%, 100% { left: 0; }
              50% { left: 80%; }
            }
            @keyframes shiftColor {
              0% { background-position: 0% 50%; }
              100% { background-position: 100% 50%; }
            }
            .animated-bar {
              width: 20%;
              height: 100%;
              background: linear-gradient(90deg, var(--progressBarFirstColor), var(--progressBarSecondColor), var(--progressBarFirstColor), var(--progressBarSecondColor));
              background-size: 300% 100%;
              box-shadow: 0 3px 3px -5px rgba(121, 69, 197, 0.7), 0 2px 5px rgba(0, 123, 255, 0.7);
              position: absolute;
              top: 0;
              left: 0;
              border-radius: 15px;
              animation: moveBar 2s linear infinite, shiftColor 4s linear infinite;
            }
          </style>
          <div class="animated-bar"></div>
        `;
      } else {
        container.innerHTML = `
          <style>
            .file-processing-popup-progress-done {
              background: linear-gradient(to left, var(--progressBarFirstColor), var(--progressBarSecondColor));
              box-shadow: 0 3px 3px -5px rgba(121, 69, 197, 0.7), 0 2px 5px rgba(0, 123, 255, 0.7);
              color: var(--constantFileProcessingPopUpWhite);
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100%;
              width: ${processingProgress}%; /* Ensure width is based on progress */
              opacity: 1;
              border-radius: 15px;
            }
          </style>
          <div class="file-processing-popup-progress-done" style="transform: ${i18n.language === 'he' ? 'scaleX(-1)' : 'none'}">
            ${processingProgress.toFixed(2)}%
          </div>
        `;
      }
    };

    useEffect(() => {
      if (showProcessingPopup) {
        toggleProgressAnimation(false);
      }
    }, [showProcessingPopup]);
    
    useEffect(() => {
      if (!showProcessingPopup) return;
      const container = progressContainerRef.current;
      if (!container) return;
      const progressDoneElement = container.querySelector('.file-processing-popup-progress-done') as HTMLElement;
      if (progressDoneElement) {
        progressDoneElement.style.width = `${processingProgress}%`;
        progressDoneElement.textContent = `${processingProgress.toFixed(2)}%`;
      }
    }, [processingProgress, showProcessingPopup]);
  
    const DescriptionPopup: React.FC<{ message: string; message2: string; onYes: () => void; onNo: () => void; }> = ({ message, message2, onYes, onNo }) => {
      return (
        <>
          <canvas style={{ position: "absolute", top: "0", left: "0", width: "100%", height: "100%", zIndex: "-1" }}></canvas>
          <div className="add-description-popup-overlay">
            <div className="add-description-popup-main">
              <div className="add-description-popup-content">
                <p className="add-description-popup-message">{message}</p>
                <p className="add-description-popup-message" dir={isRTL ? 'rtl' : 'ltr'}>{message2}</p>
                <div className="add-description-popup-options">
                  {i18n.language === "he" ? (
                    <>
                      <button className="add-description-popup-button" onClick={onNo}>{t('no')}</button>
                      <button className="add-description-popup-button" onClick={onYes}>{t('yes')}</button>
                    </>
                  ) : (
                    <>
                      <button className="add-description-popup-button" onClick={onYes}>{t('yes')}</button>
                      <button className="add-description-popup-button" onClick={onNo}>{t('no')}</button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <style jsx>{`
              .add-description-popup-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.1); /* Darkened overlay */
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1100;
              }
              .add-description-popup-main {
                position: relative; /* Ensure positioning context for absolute children */
                background: rgba(255, 255, 255, 0.2); /* Slightly more transparent background */
                backdrop-filter: blur(10px); /* Blur effect */
                border-radius: var(--generalBorderRadius);
                padding: 30px; /* Internal padding */
                width: 75%; /* Fixed width */
                max-width: 642px; /* Maximum width */
                box-shadow: 0 8px 32px rgba(31,38,135,0.37);
                border: 1px solid rgba(255, 255, 255, 0.18); /* White outline */
                background-image: repeating-linear-gradient(
                  45deg,
                  #404c7a, /* Darker blue shade */
                  #404c7a 5%,
                  #2d3b6d 5%, /* Darker shade for contrast */
                  #2d3b6d 10% /* Darker shade for contrast */
                );
                background-size: 100px 100px;
                animation: move-it 2s linear infinite; /* Apply the moving background animation */
              }
              .add-description-popup-content {
                position: relative;
                z-index:1;
                text-align: center;
                padding:.6rem; /* Padding inside modal content */
              }
              .add-description-popup-message {
                margin: 10px 0;
                font-size: 18px; /* Font size adjustment */
                color: white; /* White text color */
                word-wrap: break-word; /* Ensure text wraps within container */
                overflow-wrap: break-word; /* Prevent overflow beyond container */
              }
              .add-description-popup-options {
                display: flex; /* Use flexbox for button alignment */
              }
              .add-description-popup-button {
                flex-grow: 1; /* Make buttons take equal space */
                margin-right: .5rem; /* Increased margin between buttons */
                color: white; /* White text color for buttons */
                font-size: inherit;
                padding: .7rem; /* Increased padding within buttons */
                border-radius: var(--generalBorderRadius);
                border:none;
                background-color: #202020; /* Set default button color to #202020 */
                transition: all .3s ease; /* Smooth transition for hover effects */
              }
              .add-description-popup-button:last-child {
                margin-right: 0; /* Remove margin from the last button */
              }
              .add-description-popup-button:hover {
                background-color: #333333; /* Darker shade on hover */
                transform: translateY(-2px); /* Slight lift effect on hover */
              }
              @keyframes move-it {
                0% {
                  background-position: initial;
                }
                100% {
                  background-position: 100px 0px;
                }
              }
            `}</style>
          </div>
        </>
      );
    }

    interface DescriptionInputPopupProps {
      message: string;
      onSubmit: (description: string) => void;
      onCancel: () => void;
    }
    
     
    interface DescriptionInputPopupProps {
      message: string;
      onSubmit: (description: string) => void;
      onCancel: () => void;
    }
    
    const DescriptionInputPopup: React.FC<DescriptionInputPopupProps> = ({ message, onSubmit, onCancel }) => {
        const [description, setDescription] = useState('');
        const [inputDir, setInputDir] = useState<'ltr' | 'rtl'>('ltr');
      
        const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
          const value = event.target.value;
          setDescription(value);
      
          if (value) {
            const isRTL = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/.test(value);
            setInputDir(isRTL ? 'rtl' : 'ltr');
          } else {
            const isMessageRTL = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/.test(message);
            setInputDir(isMessageRTL ? 'rtl' : 'ltr');
          }
        };
      
        useEffect(() => {
          const isMessageRTL = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/.test(message);
          setInputDir(isMessageRTL ? 'rtl' : 'ltr');
        }, [message]);
      
        return (
          <>
            <canvas style={{ position: "absolute", top: "0", left: "0", width: "100%", height: "100%", zIndex: "-1" }}></canvas>
            <div className="add-description-popup-overlay">
              <div className="add-description-popup-main">
                <div className="add-description-popup-content">
                  <p className="add-description-popup-message">{message}</p>
                  <input
                    type="text"
                    value={description}
                    onChange={handleInput}
                    className="add-description-popup-input"
                    style={{ direction: inputDir }}
                  />
                  <div className="add-description-popup-options">
                    {i18n.language === "he" ? (
                      <>
                        <button className="add-description-popup-button" onClick={onCancel}>{t('cancel')}</button>
                        <button className="add-description-popup-button" onClick={() => onSubmit(description)}>{t('submit')}</button>
                      </>
                    ) : (
                      <>
                        <button className="add-description-popup-button" onClick={() => onSubmit(description)}>{t('submit')}</button>
                        <button className="add-description-popup-button" onClick={onCancel}>{t('cancel')}</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <style jsx>{`
                .add-description-popup-overlay {
                  position: fixed;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  background-color: rgba(0, 0, 0, 0.1);
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  z-index: 1100;
                }
                .add-description-popup-main {
                  position: relative;
                  background: rgba(255, 255, 255, 0.2);
                  backdrop-filter: blur(10px);
                  border-radius: var(--generalBorderRadius);
                  padding: 30px;
                  width: 75%;
                  max-width: 642px;
                  box-shadow: 0 8px 32px rgba(31,38,135,0.37);
                  border: 1px solid rgba(255, 255, 255, 0.18);
                  background-image: repeating-linear-gradient(
                    45deg,
                    #404c7a,
                    #404c7a 5%,
                    #2d3b6d 5%,
                    #2d3b6d 10%
                  );
                  background-size: 100px 100px;
                  animation: move-it 2s linear infinite;
                }
                .add-description-popup-content {
                  position: relative;
                  z-index:1;
                  text-align: center;
                  padding:.6rem;
                }
                .add-description-popup-message {
                  margin: 10px 0;
                  font-size: 18px;
                  color: white;
                  word-wrap: break-word;
                  overflow-wrap: break-word;
                }
                .add-description-popup-input {
                  width :100%;
                  padding:.5rem;
                  margin-bottom:.8rem;
                  border-radius: var(--generalBorderRadius);
                  border:none;
                  resize:none; 
                  background-color: rgba(255,255,255,.1);
                  color: white; 
                  caret-color: white; 
                }
                .add-description-popup-options {
                  display: flex; 
                }
                .add-description-popup-button {
                  flex-grow: 1; 
                  margin-right:.5rem; 
                  color:white; 
                  font-size: inherit; 
                  padding:.7rem; 
                  border-radius: var(--generalBorderRadius);
                  border:none; 
                  background-color:#202020; 
                  transition:.3s ease; 
                }
                .add-description-popup-button:last-child {
                    margin-right:0; 
                }
                .add-description-popup-button:hover {
                    background-color:#333333; 
                    transform:translateY(-2px); 
                }
                @keyframes move-it {
                    0% { background-position: initial; }
                    100% { background-position: 100px 0px; }
                }
              `}</style>
            </div>
          </>
        );
      }

    return (
        <div className="flex flex-col items-center">
          {descriptionPopup}
          {showProcessingPopup && (
            <div className="file-processing-popup">
              <div className="file-processing-popup-main">
                <div className="file-processing-popup-content">
                  <p className="file-processing-popup-message-text">
                    <span className="filename-span" dir="auto">{currentFileName}</span>
                  </p>
                  <p className="file-processing-popup-message-text"
                      dir={isRTL ? 'rtl' : 'ltr'}
                  >
                    {processingStep}
                  </p>
                  <p 
                    className="file-processing-popup-message-text" 
                    dir={isRTL ? 'rtl' : 'ltr'}
                  >
                    {processingStepDescription}
                  </p>
                  <div 
                    ref={progressContainerRef} 
                    className="file-processing-popup-progress"
                    style={{ transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none' }}
                  >
                    {/* Progress bar or animation will be inserted here */}
                  </div>
                </div>
              </div>
            </div>
          )}
          <style jsx>{`
            .file-processing-popup {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-color: rgba(0, 0, 0, 0.5);
              display: flex;
              justify-content: center;
              align-items: center;
              z-index: 1000;
            }

            .file-processing-popup-main {
              max-width: 640px;
              width: 90%;
              padding: 20px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              align-items: center;
              background: rgba(25, 26, 26, 0.5);
              backdrop-filter: blur(10px) saturate(90%);
              border-radius: var(--generalBorderRadius);
              border: 1px solid rgba(255, 255, 255, 0.18);
            }

            .file-processing-popup-content {
              text-align: center;
              overflow-wrap: break-word; /* Prevent overflow beyond container */
              word-wrap: break-word;
              width: 90%;
            }

            .file-processing-popup-message-text {
              margin: 10px 0;
              font-size: 18px;
              color: var(--constantFileProcessingPopUpWhite);
              word-wrap: break-word;
              overflow-wrap: break-word;
            }

            .filename-span {
              font-weight: bold;
              color: var(--constantFileProcessingPopUpFilenameColor);
              display: inline-block;
              overflow-wrap: break-word; /* Prevent overflow beyond container */
              width: 94%;
              max-width: 560px; /* Optional, to limit the maximum width */
              word-wrap: break-word;
            }

            .file-processing-popup-progress {
              background-color: var(--descriptionGray);
              border-radius: 20px;
              position: relative;
              margin: 15px 0;
              height: 30px;
              width: 100%; /* Ensure progress bar width is consistent */
              max-width: 560px; /* Optional, to limit the maximum width */
              overflow: hidden;
            }
          `}</style>

            {/* Calculate Dropzone Width */}
            <div 
                style={{ 
                    marginTop: "2.25rem", 
                    width: `${Math.max(352, columns * 352 + (columns - 1) * 36)}px`
                }}
            >
                <Dropzone onFilesAdded={handleFilesAdded} />
            </div>
            
            <BentoGrid className={`mt-9`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
                {containers.map(file => (
                    <BentoGridItem key={file.id}>
                        <FileContainer
                            id={file.id}
                            title={file.title}
                            color={fileTypeClassification.find(type =>
                                type.extensions.some(ext => file.title.toLowerCase().endsWith(ext))
                            )?.color || '#3D4785'}
                            fileSize={file.fileSize}
                            description={file.description}
                            onGetTag={handleGetTag}
                            onShowAllOptions={handleOptionsClick}
                            onTitleClick={handleOptionsClick}
                            onDescriptionClick={handleOptionsClick}
                            metadataIntegrity = {file.metadataIntegrity}
                        />
                    </BentoGridItem>
                ))}
            </BentoGrid>
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
            <div className="p-8 mb-4 text-center"> {/* Padding and margin for spacing */}
              <span 
                onClick={handleRefresh} 
                className="text-gray-600 cursor-pointer"
              >
                {t('refresh')}
              </span>
            </div>
            <div ref={notificationContainerRef} className={styles.notificationContainer}></div>
        </div>
    );
};

export default SharedFilesContentContent;