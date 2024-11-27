// src/pages/page.tsx
'use client';

import React, { useState } from 'react';
import HomePage from '../components/HomePage';
import LoginPage from '../components/LoginPage'; // Import the LoginPage component

export default function Home() {
  const [showLogin, setShowLogin] = useState(false); // State to control login visibility
  const [isRegistering, setIsRegistering] = useState(false); // State to distinguish between login and register

  return (
    <div className="flex flex-col">
      {/* Render HomePage or LoginPage based on state */}
      {!showLogin ? (
        <HomePage 
          setShowLogin={setShowLogin} 
          setIsRegistering={setIsRegistering} 
        />
      ) : (
        <LoginPage 
        setShowLogin={setShowLogin} 
        isRegistering={isRegistering}
        setIsRegistering={setIsRegistering} 
        updateLoginStatus={() => {
          setShowLogin(false); // Close login when successfully logged in
        }} 
      />
      )}
    </div>
  );
}