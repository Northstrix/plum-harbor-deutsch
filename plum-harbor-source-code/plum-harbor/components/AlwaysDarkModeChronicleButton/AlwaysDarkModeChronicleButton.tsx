"use client"
import React from 'react';
import styles from './AlwaysDarkModeChronicleButton.module.css';

interface ChronicleButtonProps {
  text: string;
  onClick?: () => void;
  hoverColor?: string;
  width?: string;
  outlined?: boolean;
  outlinePaddingAdjustment?: string;
  fontFamily?: string; // New prop for font family
}

const ChronicleButton: React.FC<ChronicleButtonProps> = ({ 
  text, 
  onClick, 
  hoverColor = 'var(--alwaysDarkModeDefaultChronicleHoverColor)', 
  width = '160px',
  outlined = false,
  outlinePaddingAdjustment = '2px',
  fontFamily // Accept font family as a prop
}) => {
  const buttonStyle = {
    '--hover-color': hoverColor,
    '--text-color': outlined ? 'var(--alwaysDarkModeForeground)' : 'var(--alwaysDarkModenegativeForeground)',
    '--outline-padding-adjustment': outlinePaddingAdjustment,
    width: width,
    fontFamily: fontFamily // Apply font family to button style
  } as React.CSSProperties;

  return (
    <button 
      className={`${styles.chronicleButton} ${outlined ? styles.outlined : ''}`}
      onClick={onClick}
      style={buttonStyle}
    >
      <span><em>{text}</em></span>
      <span><em>{text}</em></span>
    </button>
  );
};

export default ChronicleButton;