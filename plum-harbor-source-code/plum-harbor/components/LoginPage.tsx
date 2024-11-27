'use client';

import React, { useRef, useCallback } from 'react';
import ChronicleButton from '@/components/ui/ChronicleButton/ChronicleButton'; // Adjust the import path as necessary
import { useTranslation } from 'react-i18next';
import CLikeInputField from '@/components/ui/CLikeInputField/CLikeInputField'; // Import the CLikeInputField component
import Swal from 'sweetalert2'; // Import SweetAlert2
import { argon2id, whirlpool, sha512 } from 'hash-wasm';
import { encryptSerpent256ECB } from '@/app/cryptographicPrimitives/serpent';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth"
import { db, auth } from '@/app/lib/firebase';
import { doc, setDoc, getDoc, collection } from "firebase/firestore"; 
import useStore from '@/store/store';
import { FirebaseError } from 'firebase/app';
import { MlKem1024 } from 'mlkem';
import { silentlyEncryptDataWithTwoCiphersCBC } from '@/app/cryptographicPrimitives/twoCiphersSilentMode';

interface LoginPageProps {
  setShowLogin: (show: boolean) => void; // Function to control visibility of the login form
  isRegistering: boolean; // To determine if we are in register mode
  setIsRegistering: (isRegistering: boolean) => void; // Function to switch between login and register
  updateLoginStatus: (status: boolean) => void; // New prop name for updating login status
}

const LoginPage: React.FC<LoginPageProps> = ({ isRegistering, setIsRegistering, setShowLogin }) => {
  const { t, i18n } = useTranslation();

  // Create individual refs for each input field
  const usernameRefRegister = useRef<HTMLInputElement>(null);
  const passwordRefRegister = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  
  const usernameRefLogin = useRef<HTMLInputElement>(null);
  const passwordRefLogin = useRef<HTMLInputElement>(null);

  const {setLoginData, setIsLoggedIn } = useStore();

  // Determine if the current language is RTL
  const isRTL = i18n.language === 'he';

  const derive336BytesUsingArgon2id = useCallback(async (
    password: string, 
    salt: Uint8Array, 
    iterations: number,
  ): Promise<Uint8Array> => {
    const derivedKey = await argon2id({
      password,
      salt,
      parallelism: 1,
      iterations,
      memorySize: 512,
      hashLength: 336,
      outputType: 'binary',
    });
    return new Uint8Array(derivedKey);
  }, []);

  const handleSignIn = async () => {
    const username = usernameRefLogin.current?.value;
    const password = passwordRefLogin.current?.value;

    if (!username) {
        Swal.fire({
            icon: "error",
            title: t('error_inscription'),
            html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('username_empty_title')}</p>`,
            width: 600,
            padding: "3em",
            color: "var(--foreground)",
            background: "var(--background)",
            confirmButtonText: t('ok_button'),
            confirmButtonColor: "var(--firstThemeColor)"
        });
        return false; // Indicate failure
    }

    if (!password) {
        Swal.fire({
            icon: "error",
            title: t('error_inscription'),
            html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('password_empty_title')}</p>`,
            width: 600,
            padding: "3em",
            color: "var(--foreground)",
            background: "var(--background)",
            confirmButtonText: t('ok_button'),
            confirmButtonColor: "var(--firstThemeColor)"
        });
        return false; // Indicate failure
    }

    Swal.fire({
        title: t('deriving_keys'), // Use translation key for this message
        html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>`, // Use translation key for this message
        color: "var(--foreground)",
        background: "var(--background)",
        width: 640,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
};

const handleSignInContinue = async () => {
  const username = usernameRefLogin.current?.value;
  const password = passwordRefLogin.current?.value;

  if (!username || !password) {
      return; // Early exit if validation fails
  }

const sha512_output = await sha512(username);
const sha512Array = hexStringToArray(sha512_output);
const byteArray = new Uint8Array(sha512Array);
const generatedHash = await whirlpool(byteArray);
const hashedUsername = new Uint8Array(hexStringToArray(generatedHash));
const salt = hashedUsername .slice(24, 48);
// test salt: const salt = new Uint8Array([97, 98, 99, 100, 101, 102, 103, 104]);
const iterationBytes = hashedUsername.slice(16);
const derIterations = iterationBytes.reduce((acc, val) => acc + val, 0);
const iterations = 500 + (derIterations % 50001);
const derivedKey = await derive336BytesUsingArgon2id(username + password, salt, iterations);
const userID1 = derivedKey.slice(0, 16);
const userID2 = derivedKey.slice(16, 32);
const unencryptedPassword = userID1.map((byte, index) => byte ^ userID2[index]);
const userCredentialEncryptionKey = derivedKey.slice(32, 64);
const secondHash = await whirlpool(hashedUsername);
const secondHashArray = new Uint8Array(hexStringToArray(secondHash));
const secondHashArray1 = secondHashArray.slice(0, 16);
const secondHashArray2 = secondHashArray.slice(16, 32);
const unencryptedUsername = secondHashArray1.map((byte, index) => byte ^ secondHashArray2[index]);
const encryptedUsername = encryptSerpent256ECB(unencryptedUsername, userCredentialEncryptionKey);
const encryptedUserPassword = encryptSerpent256ECB(unencryptedPassword, userCredentialEncryptionKey);
//console.log("Username:" + uint8ArrayToString(encryptedUsername));
//console.log("Password:" + arrayToHexString(encryptedUserPassword));
try {
  // Display loading message during sign-in
  Swal.fire({
      title: t('signing_in'), // Use translation key for this message
      html: `<p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>`, // Use translation key for this message
      color: "var(--foreground)",
      background: "var(--background)",
      width: 640,
      allowOutsideClick: false,
      didOpen: () => {
          Swal.showLoading();
      }
  });

  // Attempt to sign in with email and password
  await signInWithEmailAndPassword(
      auth,
      uint8ArrayToString(encryptedUsername) + "@plum-harbor.app",
      arrayToHexString(encryptedUserPassword)
  );
  const user = auth.currentUser;
  if (user) {
    const docRef = doc(db, 'data', `${user.email}/private/settings`);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const userSettings = docSnap.data();
      if (userSettings) {
        const { setTheme } = useStore.getState();
        setTheme(userSettings.theme || 'Dark');
        i18n.changeLanguage(userSettings.language || 'en');
      }
    } else {
      console.error("Can't retrieve settings from Firebase!");
    }
  }
  // Close loading modal after successful sign-in
  Swal.close();
  // Continue with fingerprint generation and login data setup
  const sha512HashOutput = await sha512(derivedKey.slice(64));
  const sha512ByteArray = hexStringToArray(sha512HashOutput);
  const sha512Uint8Array = new Uint8Array(sha512ByteArray);
  const whirlpoolHash = await whirlpool(sha512Uint8Array);
  
  let fingerprintSourceArray = new Uint8Array(hexStringToArray(whirlpoolHash));

  while (fingerprintSourceArray.length > 8) {
      fingerprintSourceArray = xorHalves(fingerprintSourceArray);
  }

  if (fingerprintSourceArray.length < 8) {
      const paddedArray = new Uint8Array(8);
      paddedArray.set(fingerprintSourceArray);
      fingerprintSourceArray = paddedArray;
  }

  const formattedFingerprint =
      `${byteToHex(fingerprintSourceArray.slice(0, 2))}-` +
      `${byteToHex(fingerprintSourceArray.slice(2, 4))}-` +
      `${byteToHex(fingerprintSourceArray.slice(4, 6))}-` +
      `${byteToHex(fingerprintSourceArray.slice(6, 8))}`;

  // Set login data and update login state
  setLoginData(derivedKey.slice(64), username, iterations, formattedFingerprint);
  setIsLoggedIn(true);
  setShowLogin(false);

} catch (error) {
  // Close any open Swal modal before showing error
  Swal.close();

  let errorMessage;

  // Type guard to check if error is of type FirebaseError
  if (error instanceof Error) {
      if (error instanceof FirebaseError && error.code === 'auth/invalid-credential') {
          errorMessage = `
              <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('invalid_credentials_line0')}</p>
              <p dir="${isRTL ? 'rtl' : 'ltr'}">${t('invalid_credentials_line1')}</p>
              <p dir="${isRTL ? 'rtl' : 'ltr'}">${t('invalid_credentials_line2')}</p>`;
          Swal.fire({
              icon: "error",
              title: t('access_denied'),
              html: errorMessage,
              width: 600,
              padding: "3em",
              color: "var(--foreground)",
              background: "var(--background)",
              confirmButtonText: t('ok_button'),
              confirmButtonColor: "var(--firstThemeColor)"
          });
      } else {
          errorMessage = `
              <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('something_went_wrong_line1')}</p>
              <p dir="${isRTL ? 'rtl' : 'ltr'}">${t('check_the_console')}</p>`;
          console.log("Sign-in error:", error.message);
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
      }
  } else {
      // Handle unexpected error types
      errorMessage = `
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('unexpected_error_occurred_line1')}</p>
          <p dir="${isRTL ? 'rtl' : 'ltr'}">${t('check_the_console')}</p>`;
      
      console.log("Unexpected error:", error);
      
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
  }
}
};

  const handleSignUp = async () => {
    const username = usernameRefRegister.current?.value;
    const password = passwordRefRegister.current?.value;
    const confirmPassword = confirmPasswordRef.current?.value;

    if (!username) {
        Swal.fire({
            icon: "error",
            title: t('error_inscription'),
            html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('username_empty_title')}</p>`,
            width: 600,
            padding: "3em",
            color: "var(--foreground)",
            background: "var(--background)",
            confirmButtonText: t('ok_button'),
            confirmButtonColor: "var(--firstThemeColor)"
        });
        return false; // Indicate failure
    }

    if (!password) {
        Swal.fire({
            icon: "error",
            title: t('error_inscription'),
            html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('password_empty_title')}</p>`,
            width: 600,
            padding: "3em",
            color: "var(--foreground)",
            background: "var(--background)",
            confirmButtonText: t('ok_button'),
            confirmButtonColor: "var(--firstThemeColor)"
        });
        return false; // Indicate failure
    }

    if (password !== confirmPassword) {
        Swal.fire({
            icon: "error",
            title: t('error_inscription'),
            html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('password_mismatch_text')}</p>`,
            width: 600,
            padding: "3em",
            color: "var(--foreground)",
            background: "var(--background)",
            confirmButtonText: t('ok_button'),
            confirmButtonColor: "var(--firstThemeColor)"
        });
        return false; // Indicate failure
    }

    Swal.fire({
        title: t('deriving_keys'), // Use translation key for this message
        html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>`, // Use translation key for this message
        color: "var(--foreground)",
        background: "var(--background)",
        width: 640,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
};

const handleSignUpContinue = async () => {
    const username = usernameRefRegister.current?.value;
    const password = passwordRefRegister.current?.value;
    const confirmPassword = confirmPasswordRef.current?.value;

    if (!username || !password || password !== confirmPassword) {
        return; // Early exit if validation fails
    }

  const sha512_output = await sha512(username);
  const sha512Array = hexStringToArray(sha512_output);
  const byteArray = new Uint8Array(sha512Array);
  const generatedHash = await whirlpool(byteArray);
  const hashedUsername = new Uint8Array(hexStringToArray(generatedHash));
  const salt = hashedUsername .slice(24, 48);
  // test salt: const salt = new Uint8Array([97, 98, 99, 100, 101, 102, 103, 104]);
  const iterationBytes = hashedUsername.slice(16);
  const derIterations = iterationBytes.reduce((acc, val) => acc + val, 0);
  const iterations = 500 + (derIterations % 50001);
  const derivedKey = await derive336BytesUsingArgon2id(username + password, salt, iterations);
  const userID1 = derivedKey.slice(0, 16);
  const userID2 = derivedKey.slice(16, 32);
  const unencryptedPassword = userID1.map((byte, index) => byte ^ userID2[index]);
  const userCredentialEncryptionKey = derivedKey.slice(32, 64);
  const secondHash = await whirlpool(hashedUsername);
  const secondHashArray = new Uint8Array(hexStringToArray(secondHash));
  const secondHashArray1 = secondHashArray.slice(0, 16);
  const secondHashArray2 = secondHashArray.slice(16, 32);
  const unencryptedUsername = secondHashArray1.map((byte, index) => byte ^ secondHashArray2[index]);
  const encryptedUsername = encryptSerpent256ECB(unencryptedUsername, userCredentialEncryptionKey);
  const encryptedUserPassword = encryptSerpent256ECB(unencryptedPassword, userCredentialEncryptionKey);
  //console.log("Username:" + uint8ArrayToString(encryptedUsername));
  //console.log("Password:" + arrayToHexString(encryptedUserPassword));
  Swal.fire({
    title: t('creating_account'), // Use translation key for this message
    html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>`, // Use translation key for this message
    color: "var(--foreground)",
    background: "var(--background)",
    width: 640,
    allowOutsideClick: false,
    didOpen: () => {
        Swal.showLoading();
    }
});

let registrationSuccessful = false; // Flag to track registration success
const cut_iterations = parseInt((iterations / 10).toString(), 10);

try {
    await createUserWithEmailAndPassword(
        auth,
        uint8ArrayToString(encryptedUsername) + "@plum-harbor.app",
        arrayToHexString(encryptedUserPassword)
    );

    registrationSuccessful = true; // Set flag to true if registration succeeds

} catch (error) {
    let errorMessage;

    if (error instanceof FirebaseError) {
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = `<p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('username_taken_line1')}</p><p dir="${isRTL ? 'rtl' : 'ltr'}">${t('username_taken_line2')}</p>`;
        } else {
            errorMessage = `<p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('something_went_wrong_line1')}</p><p dir="${isRTL ? 'rtl' : 'ltr'}">${t('check_the_console')}</p>`;
            console.log("User registration error:", error.message);
        }
    } else {
        // Handle unexpected error types
        errorMessage = `<p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('unexpected_error_occurred_line1')}</p><p dir="${isRTL ? 'rtl' : 'ltr'}">${t('check_the_console')}</p>`;
        console.log("Unexpected error:", error);
    }

    Swal.fire({
        icon: "error",
        title: t('error_inscription'),
        html: errorMessage, // Display the error message with correct direction
        width: 600,
        padding: "3em",
        color: "var(--foreground)",
        background: "var(--background)",
        confirmButtonText: t('ok_button'),
        confirmButtonColor: "var(--firstThemeColor)"
    });
    
    return; // Exit the function after displaying the error
}

// Show success message only if registration was successful
if (registrationSuccessful) {

    await signInWithEmailAndPassword(
      auth,
      uint8ArrayToString(encryptedUsername) + "@plum-harbor.app",
      arrayToHexString(encryptedUserPassword)
    );

    const user = auth.currentUser;
    try{
      if (user) {    
        const userSettings = {
          language: i18n.language,
        };
        const docRef = doc(collection(db, 'data'), `${user.email}/private/settings`);
        await setDoc(docRef, userSettings);
      }
    } catch{

    }

    try {
      Swal.fire({
        title: t('generating mlkem1024-key-pair'), // Use translation key for this message
        html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>`, // Use translation key for this message
        color: "var(--foreground)",
        background: "var(--background)",
        width: 640,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
      const recipient = new MlKem1024();
      const [pkR, skR] = await recipient.generateKeyPair();
      //console.log("Generated Public Key:", pkR);
      //console.log("Generated Private Key:", skR);
      if (user) {        
        try {
          Swal.fire({
            title: t('uploading_mlkem_public_key_to_firebase'), // Use translation key for this message
            html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>`, // Use translation key for this message
            color: "var(--foreground)",
            background: "var(--background)",
            width: 640,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
          // Convert public key to hex string
          const publicKey = btoa(String.fromCharCode(...pkR));
          
          // Create an object to store the public key
          const publicKeyData = {
            publicKey
          };
          
          // Create a document reference in Firestore with the new path
          const docRef = doc(collection(db, 'data'), `${user.email}/public/mlkem-public-key`);
          
          // Store the public key data in Firestore
          await setDoc(docRef, publicKeyData);
    
        } catch (error) {
          // Handle MLKEM key setup warning
          console.error("Failed to upload MLKEM public key to Firebase:", error);

          const warningMessage = `
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('account_created_successfully')}</p>
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('mlkem_key_setup_failed')}</p>
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('failed_to_upload_mlkem_public_key_to_firebase')}</p>
          `;
          
          Swal.fire({
            icon: "warning",
            title: t('warning'), // Set title to 'Warning'
            html: warningMessage, // Use the formatted warning message
            width: 600,
            padding: "3em",
            color: "var(--foreground)",
            background: "var(--background)",
            confirmButtonText: t('ok_button'),
            confirmButtonColor: "var(--firstThemeColor)"
          });
        }


      } else {
        // Handle case where user cannot log in
        console.error("Unable to log in to the newly created account. The MLKEM key setup has failed.");

        const warningMessage = `
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('account_created_successfully')}</p>
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('mlkem_key_setup_failed')}</p>
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('cant-log-in-in-to-newly-created-account')}</p>
        `;
        
        Swal.fire({
          icon: "warning",
          title: t('warning'), // Set title to 'Warning'
          html: warningMessage, // Use the formatted warning message
          width: 600,
          padding: "3em",
          color: "var(--foreground)",
          background: "var(--background)",
          confirmButtonText: t('ok_button'),
          confirmButtonColor: "var(--firstThemeColor)"
        });
      }

      if (user) {        
        try {
          Swal.fire({
            title: t('encrypting-mlkem-private-key'), // Use translation key for this message
            html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>`, // Use translation key for this message
            color: "var(--foreground)",
            background: "var(--background)",
            width: 640,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

          const encryptedPrivateKey = await silentlyEncryptDataWithTwoCiphersCBC(skR, derivedKey.slice(64), cut_iterations);
          // Decryption test
          //const [decryptedData, integrityFailed] = await silentlyDecryptDataWithTwoCiphersCBC(encryptedPrivateKey, derivedKey.slice(64), cut_iterations);
          //console.log("Decrypted Private Key:", decryptedData);
          //console.log("Integrity Failed:", integrityFailed);
          Swal.fire({
            title: t('uploading_mlkem_private_key_to_firebase'), // Use translation key for this message
            html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>`, // Use translation key for this message
            color: "var(--foreground)",
            background: "var(--background)",
            width: 640,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
          const privateKey = btoa(String.fromCharCode(...encryptedPrivateKey));
          
          // Create an object to store the public key
          const privateKeyData = {
            privateKey
          };
          
          // Create a document reference in Firestore with the new path
          const docRef = doc(collection(db, 'data'), `${user.email}/private/encrypted/keyring/mlkem-private-key`);
          
          // Store the public key data in Firestore
          await setDoc(docRef, privateKeyData);
    
          await new Promise(resolve => setTimeout(resolve, 75));
          Swal.fire({
            icon: "success",
            title: t('account_created_successfully_top'), // Adjust translation key as needed
            html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('you_can_sign_in_now')}</p>`, // Adjust translation key as needed
            width: 600,
            padding: "3em",
            color: "var(--foreground)",
            background: "var(--background)",
            confirmButtonText: t('ok_button'),
            confirmButtonColor: "var(--firstThemeColor)"
          });
          await new Promise(resolve => setTimeout(resolve, 75));
    
        } catch (error) {
          // Handle MLKEM key setup warning
          console.error("Failed to upload MLKEM public key to Firebase:", error);

          const warningMessage = `
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('account_created_successfully')}</p>
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('mlkem_key_setup_failed')}</p>
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('failed_to_upload_mlkem_public_key_to_firebase')}</p>
          `;
          
          Swal.fire({
            icon: "warning",
            title: t('warning'), // Set title to 'Warning'
            html: warningMessage, // Use the formatted warning message
            width: 600,
            padding: "3em",
            color: "var(--foreground)",
            background: "var(--background)",
            confirmButtonText: t('ok_button'),
            confirmButtonColor: "var(--firstThemeColor)"
          });

        }


      } else {
        // Handle case where user cannot log in
        console.error("Unable to log in to the newly created account. The MLKEM key setup has failed.");

        const warningMessage = `
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('account_created_successfully')}</p>
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('mlkem_key_setup_failed')}</p>
          <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('cant_log_in_in_to_newly_created_account')}</p>
        `;
        
        Swal.fire({
          icon: "warning",
          title: t('warning'), // Set title to 'Warning'
          html: warningMessage, // Use the formatted warning message
          width: 600,
          padding: "3em",
          color: "var(--foreground)",
          background: "var(--background)",
          confirmButtonText: t('ok_button'),
          confirmButtonColor: "var(--firstThemeColor)"
        });
      }
      auth.signOut();
    } catch (err) {
      // Handle unexpected errors
      console.error("MLKEM key setup error:", (err as Error).message);

      const warningMessage = `
        <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('account_created_successfully')}</p>
        <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('mlkem_key_setup_failed')}</p>
        <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('something_went_wrong_line1')}</p>
        <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('check_the_console')}</p>
      `;
      
      Swal.fire({
        icon: "warning",
        title: t('warning'), // Set title to 'Warning'
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
};

  function byteToHex(byteArray: Uint8Array): string {
    return Array.from(byteArray)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
  }

  // Function to XOR halves of an array
  function xorHalves(array: Uint8Array): Uint8Array {
      const halfLength = Math.floor(array.length / 2);
      const result = new Uint8Array(halfLength);
      for (let i = 0; i < halfLength; i++) {
          result[i] = array[i] ^ array[i + halfLength];
      }
      return result;
  }

  function uint8ArrayToString(uint8Array: Uint8Array): string {
    return Array.from(uint8Array).map(num => {
      // Map the number to a letter from 'a' to 'z'
      return String.fromCharCode((num % 26) + 97);
    }).join('');
  }

  const arrayToHexString = (byteArray: Uint8Array): string => {
    return Array.from(byteArray)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  };

  const hexStringToArray = (hexString: string): Uint8Array => {
    const matches = hexString.match(/.{1,2}/g);
    if (!matches) {
      throw new Error('Invalid hexadecimal string');
    }
    return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
  };

  return (
    <div 
      className={`flex items-center justify-center p-8 pb-20 sm:p-20`} 
      dir={isRTL ? 'rtl' : 'ltr'} // Set direction based on language
      style={{ minHeight: 'calc(100vh - 144px)' }}
    >
      <main className="w-full max-w-4xl">
        <div className="h-[492px] w-[392px] mx-auto flex items-center justify-center bg-transparent ">
          <div className="bg-[var(--loginFormBackground)] aspect-square flex items-center justify-center w-full h-full relative backdrop-blur-lg rounded-[var(--loginFormBorderRadius)] border-[3px] border-opacity-100 border-[var(--foreground)]"> {/* Use var(--foreground) for border */}
            <div className="absolute inset-0 flex flex-col justify-center p-6 text-[var(--foreground)] z-10">
              {isRegistering ? (
                <>
                  <h1 className="text-4xl font-bold mb-2">{t('register')}</h1>
                  <p className="mb-4" style={{ fontSize:'16px', marginTop:'6px', marginBottom:'24px' }}>
                    {t('create_an_account')}
                  </p>
                  <form className="flex flex-col w-full" onSubmit={async (e) => {
                      e.preventDefault(); // Prevent default form submission behavior

                      handleSignUp(); // Call the first function

                      // Call the second function after a delay of 100ms
                      setTimeout(() => {
                        handleSignUpContinue(); // Replace with the actual second function you want to call
                      }, 100);
                  }}>
                      <div style={{ marginBottom: '6px' }}>
                          <CLikeInputField 
                              ref={usernameRefRegister}
                              placeholder={t('username')} 
                          />
                      </div>
                      <div style={{ marginTop: '6px', marginBottom: '6px' }}>
                          <CLikeInputField 
                              ref={passwordRefRegister}
                              type='password'
                              placeholder={t('password')} 
                          />
                      </div>
                      <div style={{ marginTop: '6px', marginBottom: '12px' }}>
                          <CLikeInputField 
                              ref={confirmPasswordRef}
                              type='password'
                              placeholder={t('confirm_password')} 
                          />
                      </div>
                      <ChronicleButton 
                          text={t('register_button_label')} // "Sign up"
                          width="100%" // Full width button
                      />
                  </form>
                  <p className="mt-4" style={{ fontSize:'16px', marginTop:'24px' }}>
                    {t('already_have_account')}
                    <span className="underline cursor-pointer" onClick={() => setIsRegistering(false)}>
                      {t('log_in_bottom')}
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-4xl font-bold mb-2">{t('log_in_top')}</h1>
                  <p className="mb-4" style={{ fontSize:'16px', marginTop:'6px', marginBottom:'24px' }}>
                    {t('sign_in_to_your_account')}
                  </p>
                  <form className="flex flex-col w-full" onSubmit={async (e) => {
                      e.preventDefault(); // Prevent default form submission behavior

                      handleSignIn(); // Call the first function

                      // Call the second function after a delay of 100ms
                      setTimeout(() => {
                        handleSignInContinue(); // Replace with the actual second function you want to call
                      }, 100);
                  }}>
                    <div style={{ marginTop:'6px', marginBottom:'6px' }}>
                      <CLikeInputField 
                        ref={usernameRefLogin}
                        placeholder={t('username')} 
                      />
                    </div>
                    <div style={{ marginTop:'6px', marginBottom:'12px' }}>
                      <CLikeInputField 
                        ref={passwordRefLogin}
                        type='password'
                        placeholder={t('password')} 
                      />
                    </div>
                    <ChronicleButton 
                      text={t('login_button_label')} // "Sign in"
                      width="100%" // Full width button
                    />
                  </form>
                  <p className="mt-4" style={{ fontSize:'16px', marginTop:'24px' }}>
                    {t('no_account')}
                    <span className="underline cursor-pointer" onClick={() => setIsRegistering(true)}>
                      {t('create_one')}
                    </span>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;