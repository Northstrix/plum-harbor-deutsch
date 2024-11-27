"use client"; 
import React, { useRef, useEffect, useState, useCallback } from 'react'; 
import ChronicleButton from '@/components/AlwaysDarkModeChronicleButton/AlwaysDarkModeChronicleButton'; 
import "@fontsource/roboto-mono/700.css"; 
import { useTranslation } from 'react-i18next';
import CLikeInputField from '@/components/ui/CLikeInputField/CLikeInputField';
import { doc, getDoc, setDoc, getFirestore, collection } from "firebase/firestore";
import { MlKem1024 } from 'mlkem';
import { createSHA512, createHMAC, whirlpool, argon2id, sha512 } from 'hash-wasm';
import { ChaCha20 } from 'mipher';
import { encryptSerpent256ECB } from '@/app/cryptographicPrimitives/serpent';
import Swal from 'sweetalert2';
import useStore from '@/store/store';
import { auth} from '@/app/lib/firebase';

interface SendFileProps { 
    title: string; 
    color: string; 
    fileSize: string; 
    tag: string; // Added full description prop
    onClose: () => void; // Close function passed from parent
}

interface EncryptedFileTag {
  encryptedTag: string;
  mlkemCiphertext: string;
}

interface SentFileTag {
  data: string;
}

const SendFile: React.FC<SendFileProps> = ({ 
    title, 
    color, 
    fileSize, 
    tag, 
    onClose, 
}) => { 
    const containerRef = useRef<HTMLDivElement>(null); 
    const isJavaScriptFile = /\.(js|mjs|cjs|jsx|es6|es)$/i.test(title); 
    const hoverColor = isJavaScriptFile ? '#242424' : 'white'; 
    const displayedTitle = title.length > 41 ? title.slice(0, 38) + '...' : title; 
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'he';
    const innerContainerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(512);
    const recEmailref = useRef<HTMLInputElement>(null);
    const { masterKey, iterations } = useStore();

    useEffect(() => { 
        const checkOverflow = () => {
            if (innerContainerRef.current) {
                const innerContainer = innerContainerRef.current;
                // Check if there is vertical overflow
                if (innerContainer.scrollHeight > innerContainer.clientHeight) {
                    setContainerWidth(522); // Set width to 522px if overflow detected
                } else {
                    setContainerWidth(512); // Set width back to 512px if no overflow
                }
            }
        };

        checkOverflow(); // Check overflow on mount
        window.addEventListener('resize', checkOverflow); // Check overflow on window resize

        return () => {
            window.removeEventListener('resize', checkOverflow); // Cleanup listener
        };
    });
    useEffect(() => { 
        const container = containerRef.current; 
        if (!container) return; 
        
        const handleMouseMove = (e: MouseEvent) => { 
            const rect = container.getBoundingClientRect(); 
            const x = e.clientX - rect.left - rect.width / 2; 
            const y = e.clientY - rect.top - rect.height / 2; 
            const angle = Math.atan2(-x, y); 
            container.style.setProperty("--rotation", `${angle}rad`); 
        }; 
        
        container.addEventListener("mousemove", handleMouseMove); 
        
        return () => { 
            container.removeEventListener("mousemove", handleMouseMove); 
        }; 
    }, []);

    interface EncapsulatedSecret {
        ct: Uint8Array;
        ssS: Uint8Array;
    }

    // Function to encapsulate shared secret using the recipient's public key
    const encapsulateSecret = async (pkR: Uint8Array): Promise<EncapsulatedSecret | undefined> => {
        try {
            const sender = new MlKem1024();
            const [ct, ssS] = await sender.encap(pkR);
            //console.log("Ciphertext (ct):", ct);
            //console.log("Sender Shared Secret (ssS):", ssS);
            return { ct, ssS }; // Return ciphertext and sender's shared secret
        } catch (err) {
            console.error("Failed to encapsulate secret:", (err as Error).message);
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

    const onSend = async () => {
        //console.log(recEmailref.current?.value);
        //console.log(tag);
        const recipientEmail = `${recEmailref.current?.value}`;

        const tagArray = tag.split(",");

        if (tagArray.length !== 4 || !tagArray[0] || !tagArray[1]) {
            Swal.fire({
                icon: "error",
                title: t('error_inscription'),
                html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('invalid-tag')}</p>`,
                width: 720,
                padding: "3em",
                color: "var(--foreground)",
                background: "var(--background)",
                confirmButtonText: t('ok_button'),
                confirmButtonColor: "var(--firstThemeColor)"
            });
            return;
        }
        
        const senderEmailArray = new TextEncoder().encode(tagArray[0]); // Convert senderEmail
        const fileIdArray = new TextEncoder().encode(tagArray[1]); // Convert fileId
        
        // Step 3: Convert metadataKey and fileKey from base64 to Uint8Array
        const metadataKey = base64ToUint8Array(tagArray[2]);
        const fileKey = base64ToUint8Array(tagArray[3]);
        
        // Step 4: Concatenate all Uint8Arrays into a single Uint8Array called combinedArray
        const combinedLength = senderEmailArray.length + fileIdArray.length + metadataKey.length + fileKey.length;
        const combinedArray = new Uint8Array(combinedLength);
        
        combinedArray.set(senderEmailArray, 0);
        combinedArray.set(fileIdArray, senderEmailArray.length);
        combinedArray.set(metadataKey, senderEmailArray.length + fileIdArray.length);
        combinedArray.set(fileKey, senderEmailArray.length + fileIdArray.length + metadataKey.length);
        
        // Now combinedArray contains all elements concatenated
        //console.log("Tag", combinedArray);
        
        try {
          const user = auth.currentUser;
          if (!user) {
            await new Promise(resolve => setTimeout(resolve, 50));
            await show_authentication_error();
            throw new Error('User not authenticated');
          }

            Swal.fire({
                title: t('sending-file-tag'),
                html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>`,
                color: "var(--foreground)",
                background: "var(--background)",
                width: 720,
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });  
          const db = getFirestore(); // Initialize Firestore
          const keyRef = doc(db, `data/${recipientEmail}/public`, 'mlkem-public-key'); // Reference to the document named 'mlkem-public-key'
          const keyDoc = await getDoc(keyRef); // Fetch the document snapshot
          //console.log(`data/${recipientEmail}/public/mlkem-public-key`);
          if (!keyDoc.exists()) {
            const errorMessage = `
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('user-doesnt-exist')}</p>
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please-verify-users-internal-email')}</p>
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('invalid_credentials_line2')}</p>
            `;
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
                onClose();
            }
            });
          } else {
              const keyData = keyDoc.data(); // Get data from the document
              if (keyData && 'publicKey' in keyData) { // Check for 'publicKey' field

                const recipientPublicKey = base64ToUint8Array(keyData.publicKey);
            
                if (recipientPublicKey.length > 1) {
                  //console.log(recipientPublicKey);
                  const encapsulatedSecret = await encapsulateSecret(recipientPublicKey);
                  if (!encapsulatedSecret) return; // Ensure encapsulated secret is defined
          
                  const { ct, ssS } = encapsulatedSecret;
                  const encryptedTagArray = await encryptDataWithTwoCiphersCBC(combinedArray, ssS, 125);
                  //const [decryptedFileNameArray, integrity, paddingValidity] = await decryptStringWithTwoCiphersCBC(encryptedTag, ssS, 100);
                  //console.log(encryptedTagArray);
                  //console.log(ct);
                  const encryptedTag = btoa(String.fromCharCode(...encryptedTagArray));
                  const mlkemCiphertext = btoa(String.fromCharCode(...ct));

                  const docRef = doc(collection(db, `data/${recipientEmail}/receivedFiles`));
                  const tagData: EncryptedFileTag = {
                    encryptedTag,
                    mlkemCiphertext,
                  };
                  await setDoc(docRef, tagData);
                    //Add sent record into the list

                    const recipientId =  new TextEncoder().encode(recipientEmail.split('@')[0]); // Get everything before the '@'
                    const combinedLength1 = recipientId.length + combinedArray.length;
                    const combinedArray1 = new Uint8Array(combinedLength1);
        
                    combinedArray1.set(recipientId, 0);
                    combinedArray1.set(combinedArray, recipientId.length);
                    const new_iterations: number = Math.round(250 + (iterations / 18));
                    const encryptedTagArray1 = await encryptDataWithTwoCiphersCBC(combinedArray1, masterKey, new_iterations);

                    const docRef1 = doc(collection(db, `data/${user.email}/private/encrypted/sentFileTags`));
                    const tagData1: SentFileTag = {
                      data: btoa(String.fromCharCode(...encryptedTagArray1))
                    };
                    await setDoc(docRef1, tagData1);
                  await new Promise(resolve => setTimeout(resolve, 75));
                  Swal.fire({
                    icon: "success",
                    title: t('file-tag-sent-successfully'),
                    width: 720,
                    padding: "3em",
                    color: "var(--foreground)",
                    background: "var(--background)",
                    confirmButtonText: t('ok_button'),
                    confirmButtonColor: "var(--firstThemeColor)"
                    }).then((result) => {
                        if (result.isConfirmed) {
                            onClose();
                        }
                    });
                    return;
                }

              } else {
                const errorMessage = `
                <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('cant-find-the-recipients-public-key')}</p>
                `;
                Swal.fire({
                icon: "error",
                title: t('error_inscription'),
                html: errorMessage,
                width: 720,
                padding: "3em",
                color: "var(--foreground)",
                background: "var(--background)",
                confirmButtonText: t('ok_button'),
                confirmButtonColor: "var(--firstThemeColor)"
                }).then((result) => {
                if (result.isConfirmed) {
                    onClose();
                }
                });
              }
          }
        } catch (error) {
            console.error('Error sending the file tag:', error);
            const errorMessage = `
            <p style="margin-bottom: 10px;">Error sending the file tag:</p>
            <p>${error instanceof Error ? error.message : 'Unknown error'}</p>`;
        
            Swal.fire({
            icon: "error",
            title: t('error_inscription'),
            html: errorMessage,
            width: 720,
            padding: "3em",
            color: "var(--foreground)",
            background: "var(--background)",
            confirmButtonText: t('ok_button'),
            confirmButtonColor: "var(--firstThemeColor)"
            }).then((result) => {
            if (result.isConfirmed) {
                onClose();
            }
            });
        }
    }

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

    return ( 
        <div className="overlay"> 
            <div ref={containerRef} className="file-container" style={{ '--file-color': color, width: `${containerWidth}px` } as React.CSSProperties}> 
            <div ref={innerContainerRef} className="inner-container"> 
                    <div className="content"> 
    
                        <h1 className="text"> 
                            <span className="title" title={title}>{displayedTitle}</span> 
                            <span className="text-effect" style={{ backgroundColor: color }}></span> 
                        </h1> 
    
                        <p className="filesize">{fileSize}</p> 
    
                        {/* Conditional rendering for description */}
                        {/* Conditional rendering for description */}
                        <p className="full-description">
                            Send file to:
                        </p>
                        <div style={{ marginBottom:'16px' }}>
                            <CLikeInputField 
                                ref={recEmailref}
                                placeholder={"0123456789abcdef@plum-harbor.app"} 
                            />
                        </div>
                        {/* Bottom button container */}
                        <div className="button-container bottom-buttons">
                            {i18n.language === "he" ? (
                                <>
                                    <ChronicleButton 
                                        key="close" 
                                        text={t('close')} 
                                        width="136px" 
                                        onClick={onClose} 
                                        outlined={true} // Assuming you want the close button to be outlined
                                    />
                                    <ChronicleButton 
                                        key="send" 
                                        text={t('send')} 
                                        width="136px" 
                                        onClick={onSend} 
                                        outlined={false} // Not outlined for delete button
                                    />
                                </>
                            ) : (
                                <>
                                    <ChronicleButton 
                                        key="send" 
                                        text={t('send')} 
                                        width="136px" 
                                        onClick={onSend} 
                                        outlined={false} // Not outlined for delete button
                                    />
                                    <ChronicleButton 
                                        key="close" 
                                        text={t('close')} 
                                        width="136px" 
                                        onClick={onClose} 
                                        outlined={true} // Assuming you want the close button to be outlined
                                    />
                                </>
                            )}
                        </div>
                    </div> 
                </div> 
            </div>


            <style jsx>{`
        .overlay {
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
        .button-container { display: flex; justify-content: center; gap: 12px; padding-bottom: 16px} // Space between buttons
        .top-buttons {
            margin-bottom: 16px;
        }
                .file-container { --rotation: 2.5rad; border: 2px solid transparent; border-radius: var(--generalBorderRadius); background-image: linear-gradient(var(--loginFormBackground), var(--loginFormBackground)), linear-gradient(var(--rotation), var(--file-color), var(--file-color) 20%, var(--sharedFilesSecondColor) 80%, var(--sharedFilesSecondColor)); background-origin: border-box; background-clip: padding-box, border-box; position: relative; overflow: hidden; padding: 14px; } 

                .inner-container { width: 100%; height: 321px; max-height: 50vh; overflow-y: auto; background-color: black; border-radius: var(--generalBorderRadius); } 
        .content {
          position: relative;
          z-index: 20;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
          padding: 20px 16px;
        }
        .content::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(45deg, rgba(230, 230, 230, 0.3) 25%, transparent 25%, transparent 75%, rgba(240, 240, 240, 0.3) 75%),
                      linear-gradient(-45deg, rgba(240, 240, 240, 0.3) 25%, transparent 25%, transparent 75%, rgba(230, 230, 230, 0.3) 75%);
          background-size: 20px 20px;
          opacity: 0.5;
          z-index: -1;
        }
        .text {
          font-size: 20px;
          font-weight: bold;
          letter-spacing: var(--titleWithFancyHoverEffectLetterSpacing);
          line-height: normal;
          margin-bottom: -1px;
          width: auto;
          color: ${color};
          transition: color 0.3s ease;
          position: relative;
          overflow: hidden;
          cursor: pointer;
        }
        .text:hover {
          color: ${hoverColor} !important;
        }
        .title {
          position: relative;
          z-index: 10;
          font-size: var(--titleWithFancyHoverEffectTextSize);
          padding: 2px 4px;
        }
        .text-effect {
          clip-path: polygon(0 50%, 100% 50%, 100% 50%, 0 50%);
          transform-origin: center;
          transition: all cubic-bezier(.1,.5,.5,1) 0.4s;
          position: absolute;
          left: -4px;
          right: -4px;
          top: -4px;
          bottom: -4px;
          z-index: 0;
        }
        .text:hover > .text-effect {
          clip-path: polygon(0 0, 100% 0, 100% 100%, 0% 100%);
        }
        .filesize {
          font-size: 16px;
          color: white;
          padding-top: 16px;
          padding-bottom: 16px;
        }
        .full-description {
          font-size: 16px;
          color: white;
        }
        .tag-container {
          display: flex;
          align-items: center;
          margin-bottom: 14px;
        }
        .tag-label {
          color: var(--constantFileProcessingPopUpWhite);
          margin-right: 10px;
        }
        .tag-input {
          flex-grow: 1;
          padding: 10px;
          border: 1px solid var(--alwaysDarkModeForeground);
          border-radius: var(--generalBorderRadius);
          font-size: 14px;
          font-weight: 700;
          background-color: var(--alwaysDarkModeForeground);
          color: var(--alwaysDarkModeNegativeForeground);
        }
        .button-container {
          display: flex;
          justify-content: center;
        }
      `}</style>
        </div> ); 
}; 

export default SendFile;