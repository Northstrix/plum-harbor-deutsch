'use client'
import React, { useState, useEffect } from 'react';
import { IconSettings } from '@tabler/icons-react'; // Ensure you have this icon package installed
import { useTranslation } from 'react-i18next'; // Import useTranslation hook
import { db, auth } from '@/app/lib/firebase';
import { doc, setDoc, collection } from "firebase/firestore"; 
import Swal from 'sweetalert2'; // Import SweetAlert2
import useStore from '@/store/store';

interface ThemeColors {
    [key: string]: string; // Index signature for dynamic keys
}

const SettingsContent: React.FC = () => {
  const { t, i18n } = useTranslation(); // Initialize translation function and i18n
  const [theme, setTheme] = useState<string>('Dark');
  const {theme: zstndTheme } = useStore();

  const handleLanguageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedLanguage = event.target.value;
    i18n.changeLanguage(selectedLanguage); // Change the language using i18next
  };
  const isRTL = i18n.language === 'he'; 

  useEffect(() => {
    // Set the theme using Zustand's setTheme
    //console.log(zstndTheme);
    setTheme(zstndTheme);
    //console.log(theme);
    if (zstndTheme === 'Light') {
        applyLightTheme();
      } else {
        applyDarkTheme();
      }
  }, [zstndTheme]); // Dependency array includes zstndTheme and setTheme

  // Backup of dark theme colors
  const darkThemeColors: ThemeColors =  {
    background: '#191b24', // Dark background color
    foreground: '#f0f0f1', // Very light gray for foreground text
    negativeForeground: '#1a1a24', // Darker shade for negative text
    descriptionGray: '#86868d', // Gray for descriptions
    firstThemeColor: '#4246CE', // Deep blue for the first theme color
    middleThemeColor: '#5c3fcd', // Purple for the middle theme color
    secondThemeColor: '#7538CB', // Dark purple for the second theme color
    navbarBackgroundWhenLoggedIn: '#050607', // Very dark background for navbar when logged in
    adjacentPatternForeground: '#CECECE', // Light gray for adjacent patterns
    scrollbarHandleColorHovered: '#6c52d2', // Purple for hovered scrollbar handle
    loginFormBackground: '#020207', // Almost black background for login form
    defaultChronicleHoverColor: '#a594fd', // Soft purple for hover effects on chronicles
    eyeIconBackground: '#c1c1c9', // Light gray background for eye icon
    mobileNavigationBarBackgroundColor: '#050509', // Very dark background for mobile navbar
    notificationForeground: '#f1f1f7', // Light gray for notification text
    timerTrackColor: 'rgba(255, 255, 255, 0.3)', // Softened white color for timer tracks
    timerThumbColor: 'rgba(255, 255, 255, 0.8)', // More opacity for timer thumbs
    sharedFilesDefaultColor: '#834cd0',
    sharedFilesSecondColor: '#f0f0f1',
    
    cs1: '#005e38',
    cs2: '#03a65a',
    cw1: '#35394c',
    cw2: '#636a8e',
    ce1: '#851d41',
    ce2: '#db3056'
  };

  // Define light theme colors
  const lightThemeColors: ThemeColors = {
    background: '#f0f8ff', // Light Alice Blue background
    foreground: '#212122', // Almost black foreground
    negativeForeground: '#ffffff', // White for negative text
    descriptionGray: '#8c8c8c', // Gray for descriptions
    firstThemeColor: '#00aaff', // Bright Cyan for the first theme color
    middleThemeColor: '#2e74e1', // Medium Blue for the middle theme color
    secondThemeColor: '#5c3fcd', // Purple for the second theme color
    navbarBackgroundWhenLoggedIn: '#d3dae1', // Light gray background for navbar when logged in
    adjacentPatternForeground: '#f1f1f1', // Very light gray for adjacent patterns
    scrollbarHandleColorHovered: '#1d61cc', // Dark blue for hovered scrollbar handle
    loginFormBackground: '#ffffff', // White background for login form
    defaultChronicleHoverColor: '#33bbff', // Bright blue for hover effects on chronicles
    eyeIconBackground: '#555657',
    mobileNavigationBarBackgroundColor: '#f7f2f9', // Light pastel background for mobile navbar
    notificationForeground: '#f1f1f1', // Light gray for notification text
    timerTrackColor: 'rgba(12, 12, 18, 0.4)', // Softened dark color for timer tracks
    timerThumbColor: 'rgba(5, 5, 7, 1)', // More opacity for timer thumbs
    sharedFilesDefaultColor: '#00aaff',
    sharedFilesSecondColor: '#242426',

    cs1: '#05478a',
    cs2: '#0070e0',
    cw1: '#35394c',
    cw2: '#636a8e',
    ce1: '#851d41',
    ce2: '#db3056'
};

const handleThemeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedTheme = event.target.value;
    setTheme(selectedTheme);
    if (selectedTheme === 'Light') {
      applyLightTheme();
    } else {
      applyDarkTheme();
    }
  };

  const applyLightTheme = () => {
    Object.keys(lightThemeColors).forEach(key => {
      document.documentElement.style.setProperty(`--${key}-light`, lightThemeColors[key]);
      document.documentElement.style.removeProperty(`--${key}`);
      document.documentElement.style.setProperty(`--${key}`, `var(--${key}-light)`);
    });
  };

  const applyDarkTheme = () => {
    Object.keys(darkThemeColors).forEach(key => {
      document.documentElement.style.setProperty(`--${key}`, darkThemeColors[key]);
      document.documentElement.style.removeProperty(`--${key}-light`);
      document.documentElement.style.setProperty(`--${key}`, darkThemeColors[key]);
    });
  };

  const handleApply = async () => {
    //console.log(`Selected Theme: ${theme}`);
    //console.log(`Current Language: ${i18n.language}`);
    try{
        const user = auth.currentUser;
        if (user) {
            Swal.fire({
                title: t('saving-settings'), // Use translation key for this message
                html: `<p dir="${isRTL ? 'rtl' : 'ltr'}">${t('please_wait')}</p>`, // Use translation key for this message
                color: "var(--foreground)",
                background: "var(--background)",
                width: 640,
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
          const userSettings = {
            language: i18n.language,
            theme
          };
          const docRef = doc(collection(db, 'data'), `${user.email}/private/settings`);
          await setDoc(docRef, userSettings);
          await new Promise(resolve => setTimeout(resolve, 75));
          Swal.fire({
            icon: "success",
            title: t('settings-saved-successfully-top'), // Adjust translation key as needed
            width: 600,
            padding: "3em",
            color: "var(--foreground)",
            background: "var(--background)",
            confirmButtonText: t('ok_button'),
            confirmButtonColor: "var(--firstThemeColor)"
          });
          await new Promise(resolve => setTimeout(resolve, 75));
        } else {
            // Handle case where user cannot log in
            console.error("Authentication Error");
    
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
              confirmButtonColor: "var(--firstThemeColor)"
            });
          }
      } catch (err) {
        console.error("Error saving the settings:", (err as Error).message);

        const warningMessage = `
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('failed-to-save-settings')}</p>
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('something_went_wrong_line1')}</p>
            <p style="margin-bottom: 10px;" dir="${isRTL ? 'rtl' : 'ltr'}">${t('check_the_console')}</p>
        `;
        
        Swal.fire({
            icon: "error",
            title: t('error'),
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

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%', // Full viewport height
      backgroundColor: 'transparent', // Keep the page background color unchanged
    }}>
      <div style={{
        backgroundColor: 'var(--foreground)', // Form background color
        borderRadius: 'var(--generalBorderRadius)', // Rounded corners
        padding: '20px',
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)', // Subtle shadow for depth
        width: '400px', // Adjusted width for better layout
        display: 'flex',
        flexDirection: 'column',
        transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none', // Flip form vertically for Hebrew
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '20px', // Space between header and form
        }}>
          <IconSettings size={48} style={{ color: 'var(--background)' }} />
          <h1 style={{
            color: 'var(--background)', // Title color
            marginLeft: '10px', // Space between icon and title
            fontSize: '24px', // Title font size
            fontWeight: 'bold', // Bold labels for better visibility
            transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none',
          }}>{t('settings-tab')}</h1>
        </div>
        <form style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start', // Align labels to the left or right based on language
          width: '100%', // Full width for form elements
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center', // Align label and radio buttons on the same line
            marginBottom: '15px', // Space between fields
            fontSize: '16px', // Font size for labels
            fontWeight: 'bold', // Bold labels for better visibility
            color: 'var(--background)', // Title color
          }}>
            <div style={{
                transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none',
            }}>
            {t('word-for-language')}
            </div>
            :
            <label style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer', // Change cursor to pointer on hover
              marginLeft: '10px', // Space between label and radio button
              marginRight: '20px', // Space between options
              transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none',
            }}>
              <input
                type="radio"
                value="en"
                checked={i18n.language === 'en'}
                onChange={handleLanguageChange}
                style={{
                  marginRight: '5px', // Space between radio button and label text
                  accentColor: 'var(--middleThemeColor)', // Modern radio button color for active state
                }}
              />
              {t('language1')}
            </label>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer', // Change cursor to pointer on hover
              transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none',
            }}>
              <input
                type="radio"
                value="he"
                checked={i18n.language === 'he'}
                onChange={handleLanguageChange}
                style={{
                  marginRight: '5px', // Space between radio button and label text
                  accentColor: 'var(--middleThemeColor)', // Modern radio button color for active state
                }}
              />
              {t('language2')}
            </label>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center', // Align label and radio buttons on the same line
            marginBottom: '15px', // Space between fields
            fontSize: '16px', // Font size for labels
            fontWeight: 'bold', // Bold labels for better visibility
            color: 'var(--background)', // Title color
          }}>
            <div style={{
                transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none',
            }}>
            {t('word-for-theme')}
            </div>
            :
            <label style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer', // Change cursor to pointer on hover
              marginLeft: '10px', // Space between label and radio button
              marginRight: '20px', // Space between options
              transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none',
            }}>
              <input
                type="radio"
                value="Light"
                checked={theme === 'Light'}
                onChange={handleThemeChange}
                style={{
                  marginRight: '5px', // Space between radio button and label text
                  accentColor: 'var(--middleThemeColor)', // Modern radio button color for active state
                }}
              />
              {t('theme1')}
            </label>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer', // Change cursor to pointer on hover
              transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none',
            }}>
              <input
                type="radio"
                value="Dark"
                checked={theme === 'Dark'}
                onChange={handleThemeChange}
                style={{
                  marginRight: '5px', // Space between radio button and label text
                  accentColor: 'var(--middleThemeColor)', // Modern radio button color for active state
                }}
              />
              {t('theme2')}
            </label>
          </div>
          <button type="button" onClick={handleApply} style={{
            padding: '10px 20px',
            backgroundColor: 'var(--middleThemeColor)', // Primary button color
            color: 'var(--foreground)', // Text color for button
            border: 'none',
            borderRadius: 'var(--generalBorderRadius)', // Rounded corners using CSS variable
            cursor: 'pointer',
            transition: 'background-color 0.3s ease', // Smooth transition for hover effect
            alignSelf:"center",  // Center the button in the form 
            transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none',
            marginTop: '10px',
          }}>{t('save-settings')}</button>
        </form>
      </div>
    </div>
  );
};

export default SettingsContent;