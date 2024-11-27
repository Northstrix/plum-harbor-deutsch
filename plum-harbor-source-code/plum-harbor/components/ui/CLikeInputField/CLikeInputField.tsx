import React, { forwardRef, Ref, useState, useEffect } from 'react';
import { Eye, EyeOff } from 'tabler-icons-react'; // Importing icons from Tabler
import styles from './CLikeInputField.module.css';

type CLikeInputFieldProps = {
  placeholder?: string;
  type?: 'text' | 'password'; // Allow type prop to be text or password
};

const CLikeInputField = forwardRef<HTMLInputElement, CLikeInputFieldProps>(
  ({ placeholder = '', type = 'text' }, ref: Ref<HTMLInputElement>) => {
    const [showPassword, setShowPassword] = useState(false);
    const [inputDir, setInputDir] = useState<'ltr' | 'rtl'>('ltr'); // State to manage text direction

    const togglePasswordVisibility = () => {
      setShowPassword((prev) => !prev);
    };

    const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;

      // If there is text, check its direction
      if (value) {
        const isRTL = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/.test(value); // Hebrew, Arabic, and Persian ranges in Unicode
        setInputDir(isRTL ? 'rtl' : 'ltr'); // Set direction based on input
      } else {
        // If no text, check the placeholder for direction
        const isPlaceholderRTL = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/.test(placeholder); // Check if placeholder contains RTL characters
        setInputDir(isPlaceholderRTL ? 'rtl' : 'ltr'); // Set direction based on placeholder
      }
    };

    // Effect to set initial direction based on placeholder when component mounts
    useEffect(() => {
      const isPlaceholderRTL = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/.test(placeholder); // Check if placeholder contains RTL characters
      setInputDir(isPlaceholderRTL ? 'rtl' : 'ltr'); // Set initial direction based on placeholder
    }, [placeholder]);

    return (
      <div className={styles.inputContainer}>
        {type === 'password' && (
          <button 
            type="button" 
            onClick={togglePasswordVisibility} 
            className={styles.eyeButton} 
            style={{ left: inputDir === 'rtl' ? '10px' : 'unset', right: inputDir === 'rtl' ? 'unset' : '10px' }}
          >
            {showPassword ? (
              <EyeOff size={20} color="var(--background)" /> // Set icon color to var(--background)
            ) : (
              <Eye size={20} color="var(--background)" /> // Set icon color to var(--background)
            )}
          </button>
        )}
        <input
          type={type === 'password' && !showPassword ? 'password' : 'text'}
          ref={ref}
          placeholder={placeholder}
          className={styles.CLikeInputField}
          dir={inputDir} // Set the direction based on detected input direction or placeholder
          onInput={handleInput} // Handle input to detect direction
        />
      </div>
    );
  }
);

CLikeInputField.displayName = 'CLikeInputField'; // Set display name for debugging

export default CLikeInputField;