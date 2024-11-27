'use client';

import React, { useState, useEffect } from 'react';
import { IconUser, IconFile, IconArrowDown, IconArrowUp, IconLock, IconSettings, IconInfoCircle } from '@tabler/icons-react';
import ChronicleButton from '@/components/ui/ChronicleButton/ChronicleButton'; // Import your logout button component
import Link from 'next/link'; // Import Link for navigation
import { useTranslation } from 'react-i18next'; // Import the useTranslation hook and i18n
import ProfileContent from '@/components/Tabs/ProfileContent';
import SharedFilesContent from '@/components/Tabs/SharedFilesContent';
import ReceivedFilesContent from '@/components/Tabs/ReceivedFilesContent';
import SentFilesContent from '@/components/Tabs/SentFilesContent';
import PasswordVaultContent from '@/components/Tabs/PasswordVaultContent';
import SettingsContent from '@/components/Tabs/SettingsContent';
import AboutContent from '@/components/Tabs/AboutContent';
import useStore from '@/store/store';
import { auth } from '@/app/lib/firebase';

// Square component for logo
const Square: React.FC<{ color: string }> = ({ color }) => (
  <div style={{
    width: '12px',
    height: '12px',
    backgroundColor: color,
    margin: '2px',
    borderRadius: '50%',
  }} />
);

const TabSwitcher: React.FC<{ windowWidth: number; }> = ({  }) => {
  const [activeTab, setActiveTab] = useState(1);
  const { i18n, t } = useTranslation();
  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);
  const [showConfirmPopUp, setShowConfirmPopUp] = useState(false);
  const { setIsLoggedIn, setMasterKey, setUsername, setIterations } = useStore.getState();
  const isRTL = i18n.language === 'he';
  
  // Define spacing variables
  const iconWithTextSpacing = '7px'; // Space between icon and inscription
  const menuOptionSpacing = '10px'; // Space between different menu options
  
  const [tabs, setTabs] = useState([
    { title: t('profile-info-tab'), icon: <IconUser size={24} />, textColor: 'var(--foreground)' },
    { title: t('shared-files-tab'), icon: <IconFile size={24} />, textColor: 'var(--foreground)' },
    { title: t('received-files-tab'), icon: <IconArrowDown size={24} />, textColor: 'var(--foreground)' },
    { title: t('sent-files-tab'), icon: <IconArrowUp size={24} />, textColor: 'var(--foreground)' },
    { title: t('password-vault-tab'), icon: <IconLock size={24} />, textColor: 'var(--foreground)' },
    { title: t('settings-tab'), icon: <IconSettings size={24} />, textColor: 'var(--foreground)' },
    { title: t('about-tab'), icon: <IconInfoCircle size={24} />, textColor: 'var(--foreground)' },
  ]);

  // Update tabs when language changes
  useEffect(() => {
    setTabs((prevTabs) => 
      prevTabs.map((tab, index) => ({
        ...tab,
        title: t(tab.title), // Update title based on current language
        icon: React.cloneElement(tab.icon, {
          style: {
            color: index === activeTab ? 'var(--sharedFilesDefaultColor)' : 'var(--foreground)',
          },
        }),
      }))
    );
  }, [i18n.language]);

  useEffect(() => {
    // Set tabs with updated titles based on the current language
    setTabs([
      { title: t('profile-info-tab'), icon: <IconUser size={24} />, textColor: 'var(--foreground)' },
      { title: t('shared-files-tab'), icon: <IconFile size={24} />, textColor: 'var(--foreground)' },
      { title: t('received-files-tab'), icon: <IconArrowDown size={24} />, textColor: 'var(--foreground)' },
      { title: t('sent-files-tab'), icon: <IconArrowUp size={24} />, textColor: 'var(--foreground)' },
      { title: t('password-vault-tab'), icon: <IconLock size={24} />, textColor: 'var(--foreground)' },
      { title: t('settings-tab'), icon: <IconSettings size={24} />, textColor: 'var(--foreground)' },
      { title: t('about-tab'), icon: <IconInfoCircle size={24} />, textColor: 'var(--foreground)' },
    ]);
  }, [i18n.language]); // Trigger effect when language changes

  // Update tab icons and text colors based on active tab
  useEffect(() => {
    setTabs((prevTabs) =>
      prevTabs.map((tab, index) => ({
        ...tab,
        icon: React.cloneElement(tab.icon, {
          style: {
            color: index === activeTab ? 'var(--sharedFilesDefaultColor)' : 'var(--foreground)',
          },
        }),
      }))
    );
  }, [activeTab]);

  useEffect(() => {
    // Set initial window width
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    // Add event listener for resize
    window.addEventListener('resize', handleResize);
    
    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleCancelLogOut = () => {
    setShowConfirmPopUp(false);
  };

  const handleLogOut = () => {
    setMasterKey(new Uint8Array(272).fill(Math.floor(Math.random() * 256))); // Fill with random bytes
    setUsername(`user_${Math.random().toString(36).substring(2, 15)}`); // Random username
    setIterations(Math.floor(Math.random() * 100)); // Random iterations
    setShowConfirmPopUp(false);
    auth.signOut();
    setIsLoggedIn(false);
  };
 
  const handleLogOutConfirmation = () => {
    setShowConfirmPopUp(true);
  };

  const fullBarSwitch = i18n.language === 'he' ? 1356 : 1660;

  return (
    <>
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
          padding: '1.1rem 2rem',
          border: '3px solid var(--secondThemeColor)',
          borderRadius: 'var(--generalBorderRadius)',
          color: 'black',
          zIndex: 100001,
          fontFamily: '"Questrial", sans-serif',
          backgroundColor: 'var(--logoutModalSecondColor)',
          backgroundImage: `
            linear-gradient(45deg, var(--logoutModalFirstColor) 25%, transparent 25%, transparent 75%, var(--logoutModalFirstColor) 75%, var(--logoutModalFirstColor)),
            linear-gradient(-45deg, var(--logoutModalFirstColor) 25%, transparent 25%, transparent 75%, var(--logoutModalFirstColor) 75%, var(--logoutModalFirstColor))
          `,
          backgroundSize: '60px 60px',
          backgroundPosition: '0 0',
          animation: 'slide 4s infinite linear',
          textAlign: 'center',
        }}
      >
        <div 
          style={{
            padding: '12px', // Padding for the semi-transparent container
            backgroundColor: 'rgba(255, 255, 255, 0.8)', // Semi-transparent white background
            borderRadius: 'var(--generalBorderRadius)', // Match border radius
            width: '100%', // Optional to make it full width within the pop-up
            background: 'rgba(26, 32, 48, 0.7)',
            backdropFilter: 'blur(10px) saturate(90%)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
          }}
        >
          <p className="encrypted-space-confirm-pop-up-message" dir={isRTL ? 'rtl' : 'ltr'}>{t('are-you-sure-you-want-to-log-out?')}</p>
        </div>
        <div className="encrypted-space-confirm-pop-up-options" style={{ marginTop: '20px' }}> {/* Added margin-top here */}
        { i18n.language === 'he' ? (
          <>
            <button className={`encrypted-space-confirm-pop-up-btn ${isRTL ? 'rtl' : 'ltr'}`} onClick={handleCancelLogOut}>
              {t('no')}
            </button>
            <button className={`encrypted-space-confirm-pop-up-btn ${isRTL ? 'rtl' : 'ltr'}`} onClick={handleLogOut}>
              {t('yes')}
            </button>
          </>
        ) : (
          <>
            <button className={`encrypted-space-confirm-pop-up-btn ${isRTL ? 'rtl' : 'ltr'}`} onClick={handleLogOut}>
              {t('yes')}
            </button>
            <button className={`encrypted-space-confirm-pop-up-btn ${isRTL ? 'rtl' : 'ltr'}`} onClick={handleCancelLogOut}>
              {t('no')}
            </button>
          </>
        )}
        </div>
      </div>
    )}
    <style jsx>{`
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
        font-size: 21px;
        color: var(--notificationForeground);
        text-align: center; /* Center text */
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
          box-shadow: .4rem .4rem .5rem rgba(0, 0, 0, .3); /* Darker shadow on hover */
      }

      .encrypted-space-confirm-pop-up-btn:hover.ltr {
          transform: translate(.2rem, -.2rem); /* Move slightly up for LTR */
      }

      .encrypted-space-confirm-pop-up-btn:hover.rtl {
          transform: translate(-.2rem, -.2rem); /* Move slightly up for RTL */
      }

      .encrypted-space-confirm-pop-up-options {
        display:flex; /* Flexbox for button alignment */
        flex-direction:row; /* Horizontal layout */
        justify-content:center; /* Center buttons */
      }
    `}</style>
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '72px',
        backgroundColor: 'var(--navbarBackgroundWhenLoggedIn)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        zIndex: 10000,
        transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none', // Mirror navbar if Hebrew
      }}>
        <div style={{
          maxWidth: '1920px', 
          width: '100%', 
          marginLeft: 'auto', 
          marginRight: 'auto', 
          display:'flex', 
          alignItems:'center',
        }}>
          {/* Logo */}
          <Link href="/" onClick={() => setActiveTab(1)} style={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            color:'#FFFFFF',
          }}>
            <div style={{
              display:'grid',
              gridTemplateColumns:'repeat(3, 1fr)',
              gridTemplateRows:'repeat(3, 1fr)',
              width:'44px',
              height:'44px',
              marginRight:i18n.language === 'he' ? '5px' : '8px',
              marginLeft: '8px',
              transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none', // Mirror navbar if Hebrew
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
            {(windowWidth > 1820 || (windowWidth < fullBarSwitch && windowWidth >= 768)) && (
              <span style={{
                fontSize: '24px',
                fontWeight: 'bold',
                marginLeft: '8px',
                color: 'var(--foreground)',
                transition:'color .4s linear', 
                transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none', // Mirror navbar if Hebrew
              }}>
                {t('plum-harbor')} 
              </span>
            )}
          </Link>

          {/* Tabs in the center */}
          <ul style={{
            display:'flex',
            flexGrow:'1',
            justifyContent:'center',
            listStyleType:'none',
            marginLeft:'20px',
            marginRight:'20px',
            paddingLeft:'0',
          }}>
            {tabs.map((tab, index) => (
              <li key={index} title={tab.title}>
                <label htmlFor={`tab${index + 1}`} role="button" onClick={() => setActiveTab(index)} className="tab-item" style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: (i18n.language === "he" ? "row-reverse" : "row"),
                  alignItems: 'center',
                  marginLeft: `${menuOptionSpacing}`,
                  marginRight: `${menuOptionSpacing}`,
                  transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none', // Mirror navbar if Hebrew
                }}>
                  <span className="tab-icon" style={{ color:"var(--foreground)", }}>
                    {tab.icon}
                  </span>
                  {windowWidth >= fullBarSwitch && (
                    <span className={`tab-label`} style={{
                      marginLeft: `${iconWithTextSpacing}`, 
                      marginRight: `${iconWithTextSpacing}`,
                      color: activeTab === index ? 'var(--sharedFilesDefaultColor)' : 'var(--foreground)', // Dynamic color based on active tab
                    }}>
                      {tab.title}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
          
          {/* Language Switch Button */}
          <div style={{ backgroundColor:"transparent", paddingLeft:"10px", paddingRight:"10px", transform: i18n.language === 'he' ? 'scaleX(-1)' : 'none' }}>
            <ChronicleButton text={t('log-out-the-verb')} width="112px" outlined={true} outlinePaddingAdjustment="4px" onClick={handleLogOutConfirmation}></ChronicleButton>
          </div>
        </div>
      </nav>

      {/* Demo Tabs Below Navbar */}
      <div style={{
        paddingTop:'72px', 
        height:`calc(100vh)`, 
        overflowY:'auto' 
      }}>
      {tabs.map((tab, index) => (
        <>

        <div key={index} style={{
          display: (activeTab === index) ? "block" : "none",
          height: '100%',
        }}>
          {index === 0 ? (
              <ProfileContent />
          ) : index === 1 ? (
              <SharedFilesContent />
          ) : index === 2 ? (
              <ReceivedFilesContent />
          ) : index === 3 ? (
              <SentFilesContent />
          ) : index === 4 ? (
              <PasswordVaultContent />
          ) : index === 5 ? (
              <SettingsContent />
          ) : index === 6 ? (
              <AboutContent />
          ) : (
              <></>
          )}
        </div>
        </>
      ))}
      </div>
    </>
  );
};

export default TabSwitcher;