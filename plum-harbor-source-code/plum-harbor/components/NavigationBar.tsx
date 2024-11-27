'use client';

import React, { useState, useEffect, useRef } from 'react';
import ChronicleButton from '@/components/ui/ChronicleButton/ChronicleButton';
import Link from 'next/link'; 
import tippy from 'tippy.js'; 
import 'tippy.js/dist/tippy.css'; 
import { useTranslation } from 'react-i18next';

interface SquareProps {
  color: string;
}

const Square: React.FC<SquareProps> = ({ color }) => (
  <div style={{
    width: '12px',
    height: '12px',
    backgroundColor: color,
    margin: '2px',
    borderRadius: '50%',
  }} />
);

interface NavigationBarProps {
  setShowLogin: (show: boolean) => void; // Function to control login visibility
  setIsRegistering: (isRegistering: boolean) => void; // Function to control registration visibility
  setShowHome: () => void; // Function to show home page
}

const NavigationBar: React.FC<NavigationBarProps> = ({ setShowLogin, setIsRegistering, setShowHome }) => {
  const [opacity, setOpacity] = useState(0);
  const [language, setLanguage] = useState('en'); 
  const [appName, setAppName] = useState('Plum Harbor');
  const { i18n, t } = useTranslation();
  
  // State to track window width
  const [windowWidth, setWindowWidth] = useState(0); // Initialize with a default value

  // Create a ref for the tooltip wrapper
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  
  // Launch fade-in effect
  useEffect(() => {
    const showDelay = setTimeout(() => {
      const fadeIn = setInterval(() => {
        setOpacity((prevOpacity) => {
          if (prevOpacity >= 1) {
            clearInterval(fadeIn);
            return 1;
          }
          return prevOpacity + 0.02;
        });
      }, 30); 

      return () => clearInterval(fadeIn);
    }, 2000);

    return () => clearTimeout(showDelay);
  }, []);

  // Initialize Tippy.js for tooltips
  useEffect(() => {
    if (tooltipRef.current) {
      tippy(tooltipRef.current, {
        content: language === 'en' ? "Hebrew version" : "German version",
        placement: 'bottom',
        arrow: true,
        animation: 'shift-away',
      });
    }
  }, [language]);

  // Handle language switch with fade effect
  const handleFlagClick = () => {
    setOpacity(0); // Start fading out
  
    setTimeout(() => {
      const newLang = language === 'en' ? 'he' : 'en'; 
      i18n.changeLanguage(newLang); 
  
      if (newLang === 'he') {
        setAppName('פלאם חארבור'); 
        document.body.style.fontFamily = '"Arial", "Alef", sans-serif"'; 
      } else {
        setAppName('Plum Harbor'); 
        document.body.style.fontFamily = '"Roboto Mono", monospace"'; 
      }
  
      setLanguage(newLang); 
      setOpacity(1);
    }, 1000); 
  };

  // Effect to handle window resizing
  useEffect(() => {
    // Set initial width on mount
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    handleResize(); // Set initial width

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '72px',
      backdropFilter: windowWidth < 520 ? 'none' : 'blur(10px)', // Change backdrop filter for mobile
      backgroundColor: windowWidth < 520 ? 'var(--mobileNavigationBarBackgroundColor)' : 'transparent', // Set mobile background color
      zIndex: 1000,
      opacity: opacity,
      transition: 'opacity 0.5s linear', // Smooth transition for opacity
      transform: language === 'he' ? 'scaleX(-1)' : 'none', // Original transform for Hebrew
    }}>
      <div style={{
        maxWidth: '1336px',
        height: '100%',
        margin: '0 auto',
        padding: '0 20px',
        display: 'flex',
        justifyContent: 'space-between', // Always space between items
        alignItems: 'center',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: '#FFFFFF' }} onClick={setShowHome}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(3, 1fr)',
            width: '44px',
            height: '44px',
            marginRight: windowWidth < 520 ? undefined : '8px', 
            transform: language === 'he' ? 'scaleX(-1)' : 'none',
          }}>
            <Square color="var(--middleThemeColor)" />
            <Square color="var(--secondThemeColor)" />
            <Square color="var(--firstThemeColor)" />
            <Square color="var(--middleThemeColor)" />
            <Square color="var(--middleThemeColor)" />
            <Square color="var(--firstThemeColor)" />
            <Square color="var(--middleThemeColor)" />
            <Square color="#00000000" />
            <Square color="var(--firstThemeColor)" />
          </div>
          {/* Hide app name when screen width is less than 520px */}
          {windowWidth >= 520 && (
            <span style={{
              fontSize: '24px', 
              fontWeight: 'bold', 
              marginLeft: windowWidth < 520 ? undefined : '8px',
              transform: language === 'he' ? 'scaleX(-1)' : 'none',
              color: 'var(--foreground)'
            }}>
              {appName}
            </span>
          )}
        </Link>
        
        {/* Language Switcher and Login Button */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Tooltip wrapper with visible flag */}
          <div ref={tooltipRef} style={{ position: "relative", marginRight:"20px" }}> {/* Adjust margin here */}
              <img 
                src={language === 'he' ? "/Flag_of_Germany.svg" : "/Flag_of_Israel.svg"} // Conditional flag source
                alt={language === 'he' ? "Switch to English" : "Switch to Hebrew"}
                style={{ 
                  height: '44px', 
                  width: "auto", 
                  borderRadius:"3px", // Keep original border radius for the flag
                  transform: language === 'he' ? 'scaleX(-1)' : 'none',
                }} 
                onClick={handleFlagClick} 
              />
          </div>
          
          {/* Login Button */}
          <div style={{ backgroundColor:"transparent", paddingLeft:"10px", paddingRight:"10px", transform: language === 'he' ? 'scaleX(-1)' : 'none', }}>
                  <ChronicleButton text={t('log-in-the-verb')} width="112px" outlined={true} outlinePaddingAdjustment="4px" onClick={() => {
                    setIsRegistering(false); // Set to false for login
                    setShowLogin(true); // Show login when button is clicked
                  }} />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavigationBar;