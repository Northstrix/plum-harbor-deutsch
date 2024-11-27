"use client";

import React, { useEffect, useState, useRef } from 'react';
import { auth } from '@/app/lib/firebase';
import useStore from '@/store/store';

const ProfileContent: React.FC = () => {
    const { username, masterKeyFingerprint } = useStore();
    const [userId, setUserId] = useState<string>('');
    const [userEmail, setUserEmail] = useState<string>('');
    const [signUpDate, setSignUpDate] = useState<string>('');
    const [lastLogin, setLastLogin] = useState<string>('');
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                setUserId(user.uid);
                setUserEmail(user.email || '');
                setSignUpDate(user.metadata.creationTime || '');
                setLastLogin(user.metadata.lastSignInTime || '');
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <div id="card" ref={cardRef} className="popup-content">
            <div className="popup-inner">
                <h2 className="title">Profile Info</h2>
                <p className="popup-message"><strong>User ID:</strong> {userId || 'Loading...'}</p>
                <p className="popup-message"><strong>Username:</strong> {username || 'Loading...'}</p>
                <p className="popup-message"><strong>Master Key Fingerprint:</strong> {masterKeyFingerprint || 'Loading...'}</p>
                <p className="popup-message"><strong>Email:</strong> {userEmail || 'Loading...'}</p>
                <p className="popup-message"><strong>Signed Up At:</strong> {signUpDate ? new Date(signUpDate).toLocaleString() : 'Loading...'}</p>
                <p className="popup-message"><strong>Last Login:</strong> {lastLogin ? new Date(lastLogin).toLocaleString() : 'Loading...'}</p>
            </div>
            <style jsx>{`
                #card {
                    width: 600px;
                    max-width: 90%;
                    background-color: var(--loginFormBackground);
                    border-radius: var(--loginFormBorderRadius);
                    padding: 36px;
                    position: fixed;
                    top: 134px;
                    left: 50%;
                    transform: translateX(-50%);
                    border: 3px solid var(--foreground);
                    z-index: 1;
                    box-sizing: border-box;
                }
                .popup-inner {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    width: 100%;
                }
                .title {
                    color: var(--foreground);
                    font-size: 24px;
                    margin-bottom: 20px;
                    font-family: "Questrial", sans-serif;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                }
                .popup-message {
                    color: var(--foreground);
                    font-size: 18px;
                    margin-bottom: 15px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                    text-align: left;
                    width: 100%;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    hyphens: auto;
                }
            `}</style>
        </div>
    );
}

export default ProfileContent;