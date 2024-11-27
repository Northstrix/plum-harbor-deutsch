// src/app/layout.tsx
"use client"; // Mark this component as a Client Component
import React, { useState, useEffect } from "react";
import '@fontsource/roboto-mono/400.css';
import '@fontsource/roboto-mono/700.css';
import '@fontsource/alef/400.css'; // Import Alef regular weight
import '@fontsource/alef/700.css'; // Import Alef bold weight (optional)
import "./globals.css";
import NavigationBar from '@/components/NavigationBar'; // Original Navigation Bar
import Head from 'next/head';
import { I18nextProvider } from 'react-i18next'; // Import I18nextProvider
import i18n from '../next-i18next.config.js'; // Import your i18n configuration
import LoginPage from '@/components/LoginPage'; // Ensure correct import path
import TabSwitcher from '@/components/Tabs/TabSwitcher'; // Import TabSwitcher
import HomePage from '@/components/HomePage'; // Import HomePage component
import useStore from '@/store/store'; // Import your Zustand store
import Disclaimer from '@/components/Disclaimer'; // Import Disclaimer component

export default function RootLayout({
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [showLogin, setShowLogin] = useState(false); // State to control login visibility
  const [isRegistering, setIsRegistering] = useState(false); // State to distinguish between login and register
  const [isLoading, setIsLoading] = useState(true); // Loading state
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(false); // State for disclaimer acceptance

  const { isLoggedIn } = useStore(); // Access logged-in state from Zustand

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer); // Cleanup timer on unmount
  }, []);

  useEffect(() => {
    const accepted = localStorage.getItem('acceptedDisclaimer') === 'true';
    setIsDisclaimerAccepted(accepted);
  }, []);

  return (
    <>
      <I18nextProvider i18n={i18n}>
        <Head>
          <title>{i18n.language === 'en' ? "Plum Harbor" : "פלאם חארבור"}</title>
          <meta name="description" content="A file sharing app equipped with end-to-end encryption." />
        </Head>
        <html lang={i18n.language}>
          <body style={{
            backgroundColor: 'var(--background)',
            fontFamily: '"Roboto Mono", "Arial", "Alef", monospace',
            margin: 0,
            padding: 0,
            minHeight: '100vh',
            overflowY: 'auto',
          }}>
            {!isLoggedIn && (
              <NavigationBar 
                setShowLogin={setShowLogin} 
                setIsRegistering={setIsRegistering} 
                setShowHome={() => {
                  setShowLogin(false); // Hide login when navigating back to home
                }}
              />
            )}
            <main style={{
              paddingTop: isLoggedIn ? '0' : '72px', // Remove padding when logged in
            }}>
              {isLoading ? (
                <div style={{
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '20px',
                  textAlign: 'center'
                }}>
                  <p>Loading the web app...</p>
                  <p>Reload the page if it takes more than a minute.</p>
                </div>
              ) : !isDisclaimerAccepted ? (
                <Disclaimer 
                  onAccept={() => {
                    setIsDisclaimerAccepted(true);
                  }} 
                />
              ) : showLogin ? (
                <LoginPage 
                  setShowLogin={setShowLogin} 
                  isRegistering={isRegistering}
                  setIsRegistering={setIsRegistering} 
                  updateLoginStatus={(status) => {
                    setShowLogin(false); // Close login when successfully logged in
                    useStore.getState().setIsLoggedIn(status); // Update Zustand state directly
                  }} 
                />
              ) : isLoggedIn ? (
                <TabSwitcher 
                  windowWidth={window.innerWidth}
                />
              ) : (
                <HomePage 
                  setShowLogin={setShowLogin} 
                  setIsRegistering={setIsRegistering} 
                /> // Render HomePage if not logged in and not showing login
              )}
            </main>
          </body>
        </html>
      </I18nextProvider>
    </>
  );
}