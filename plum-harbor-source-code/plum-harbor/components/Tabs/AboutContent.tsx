"use client";

import React, { useRef } from 'react';

export default function CreditContent() {
    const cardRef = useRef<HTMLDivElement>(null);

    return (

        <div>
        <div id="card" ref={cardRef} className="popup-content">
            <div className="popup-inner">
            <h2 className="title">About</h2>
                <p className="popup-message">
                &quot;Plum Harbor&quot; is a file-sharing app that enables users to easily share, receive, send, and resend files.
                </p>
                <p className="popup-message">
                    The app employs ML-KEM-1024, ChaCha20, Serpent-256, and HMAC-SHA512 to ensure data confidentiality and integrity.
                </p>
                <p className="popup-message">
                    You can download the app&apos;s source code from:
                </p>

                <span className="text"><a id="linkanimation" href="https://sourceforge.net/projects/plum-harbor" target="_blank" rel="noopener noreferrer">SourceForge</a></span>

                <span className="text"><a id="linkanimation" href="https://github.com/Northstrix/plum-harbor" target="_blank" rel="noopener noreferrer">GitHub</a></span>

                <span className="text"><a id="linkanimation" href="https://codeberg.org/Northstrix/plum-harbor" target="_blank" rel="noopener noreferrer">Codeberg</a></span>

                <h2 className="title"><br></br></h2>

                <h2 className="title">Credit</h2>
                <p className="popup-message">
                    The existence of this project (at least in its current form) wouldn&apos;t&apos;ve been possible without the following:
                </p>

                <span className="text"><a id="linkanimation" href="https://codepen.io/swatiparge/pen/LYVMEag" target="_blank" rel="noopener noreferrer">Text Reveal Animation</a> by <a id="linkanimation" href="https://codepen.io/swatiparge" target="_blank" rel="noopener noreferrer">Swati Parge</a></span>

                <span className="text"><a id="linkanimation" href="https://codepen.io/TajShireen/pen/YzZmbep" target="_blank" rel="noopener noreferrer">Multi Colored Text with CSS</a> by <a id="linkanimation" href="https://codepen.io/TajShireen" target="_blank" rel="noopener noreferrer">Shireen Taj</a></span>

                <span className="text"><a id="linkanimation" href="https://codepen.io/Haaguitos/pen/OJrVZdJ" target="_blank" rel="noopener noreferrer">Chronicle Button</a> by <a id="linkanimation" href="https://codepen.io/Haaguitos" target="_blank" rel="noopener noreferrer">Haaguitos</a></span>

                <span className="text"><a id="linkanimation" href="https://codepen.io/utilitybend/pen/VwBRNwm" target="_blank" rel="noopener noreferrer">Named scroll-timeline vertical</a> by <a id="linkanimation" href="https://codepen.io/utilitybend" target="_blank" rel="noopener noreferrer">utilitybend</a></span>

                <span className="text"><a id="linkanimation" href="https://github.com/animate-css/animate.css" target="_blank" rel="noopener noreferrer">Animate.css</a> by <a id="linkanimation" href="https://github.com/animate-css" target="_blank" rel="noopener noreferrer">animate-css</a></span>

                <span className="text"><a id="linkanimation" href="https://github.com/tabler/tabler-icons" target="_blank" rel="noopener noreferrer">tabler-icons</a> by <a id="linkanimation" href="https://github.com/tabler" target="_blank" rel="noopener noreferrer">tabler</a></span>

                <span className="text"><a id="linkanimation" href="https://www.npmjs.com/package/@fontsource/roboto-mono" target="_blank" rel="noopener noreferrer">Fontsource Roboto Mono</a> by <a id="linkanimation" href="https://github.com/fontsource" target="_blank" rel="noopener noreferrer">fontsource</a></span>

                <span className="text"><a id="linkanimation" href="https://github.com/googlefonts/robotomono" target="_blank" rel="noopener noreferrer">Copyright 2015 The Roboto Mono Project Authors</a></span>

                <span className="text"><a id="linkanimation" href="https://www.npmjs.com/package/@fontsource/alef" target="_blank" rel="noopener noreferrer">Fontsource Alef</a> by <a id="linkanimation" href="https://github.com/fontsource" target="_blank" rel="noopener noreferrer">fontsource</a></span>

                <span className="text"><a id="linkanimation" href="http://alef.hagilda.com%7Calef@hagilda.com/" target="_blank" rel="noopener noreferrer">Copyright (c) 2012, HaGilda & Mushon Zer-Aviv</a></span>

                <span className="text"><a id="linkanimation" href="https://github.com/sweetalert2/sweetalert2" target="_blank" rel="noopener noreferrer">sweetalert2</a> by <a id="linkanimation" href="https://github.com/sweetalert2" target="_blank" rel="noopener noreferrer">sweetalert2</a></span>

                <span className="text"><a id="linkanimation" href="https://github.com/animate-css/animate.css" target="_blank" rel="noopener noreferrer">animate-css</a> by <a id="linkanimation" href="https://github.com/animate-css/animate.css">animate-css</a></span>

                <span className="text"><a id="linkanimation" href='https://github.com/i18next/react-i18next' target='_blank' rel='noopener noreferrer'>react-i18next</a> by <a id='linkanimation' href='https://github.com/i18next'>i18next</a></span>

                <span className='text'><a id='linkanimation' href='https://github.com/Daninet/hash-wasm' target='_blank' rel='noopener noreferrer'>hash-wasm</a> by <a id='linkanimation' href='https://github.com/Daninet'>Daninet</a></span>

                <span className='text'><a id='linkanimation' href='https://github.com/firebase/firebase-js-sdk' target='_blank' rel='noopener noreferrer'>firebase-js-sdk</a> by <a id='linkanimation' href='https://github.com/firebase'>firebase</a></span>

                <span className='text'><a id='linkanimation' href='https://github.com/mpaland/mipher' target='_blank' rel='noopener noreferrer'>mipher</a> by <a id='linkanimation' href='https://github.com/mpaland'>mpaland</a></span>

                <span className='text'><a id='linkanimation' href='https://codepen.io/woranov/pen/NRqLWK' target='_blank' rel='noopener noreferrer'>Pure CSS Tabs With Indicator</a> by <a id='linkanimation' href='https://codepen.io/woranov'>woranov</a></span>

                <span className='text'><a id='linkanimation' href='https://github.com/dajiaji/crystals-kyber-js' target='_blank' rel='noopener noreferrer'>crystals-kyber-js</a> by <a id='linkanimation' href='https://github.com/dajiaji'>dajiaji</a></span>

                <span className='text'><a id='linkanimation' href='https://codepen.io/ash_creator/pen/GRGZYyV' target='_blank' rel='noopener noreferrer'>深海なボタン</a> by <a id='linkanimation' href='https://codepen.io/ash_creator'>あしざわ - Webクリエイター</a></span>

                <span className='text'>
                    <a id='linkanimation' href='https://codepen.io/Gthibaud/pen/MqpmXE' target='_blank' rel='noopener noreferrer'>rémi&apos;s pop-up</a> by <a id='linkanimation' href='https://codepen.io/Gthibaud'>Tibo</a>
                </span>

                <span className='text'>
                    <a id='linkanimation' href='https://codepen.io/ash_creator/pen/zYaPZLB' target='_blank' rel='noopener noreferrer'>すりガラスなプロフィールカード</a> by <a id='linkanimation' href='https://codepen.io/ash_creator'>あしざわ - Webクリエイター</a>
                </span>

                <span className='text'>
                    <a id='linkanimation' href='https://codepen.io/IanWoodard/pen/eYyVzzq' target='_blank' rel='noopener noreferrer'>Interactive Loose-Leaf Todo List</a> by <a id='linkanimation' href='https://codepen.io/IanWoodard'>Ian</a>
                </span>

                <span className='text'>
                    <a id='linkanimation' href='https://codepen.io/utilitybend/pen/VwBRNwm' target='_blank' rel='noopener noreferrer'>Named scroll-timeline vertical</a> by <a id='linkanimation' href='https://codepen.io/utilitybend'>utilitybend</a>
                </span>

                <span className='text'>
                    <a id='linkanimation' href='https://codepen.io/nourabusoud/pen/BxJbjJ' target='_blank' rel='noopener noreferrer'>The prismatic forms</a> by <a id='linkanimation' href='https://codepen.io/nourabusoud'>Nour Saud</a>
                </span>

                <span className='text'>
                    <a id='linkanimation' href='https://codepen.io/Juxtoposed/pen/xxQNozB' target='_blank' rel='noopener noreferrer'>Vercel app border hover effect</a> by <a id='linkanimation' href='https://codepen.io/Juxtoposed'>Juxtoposed</a>
                </span>

                <span className='text'>
                    <a id='linkanimation' href='https://ui.aceternity.com/components/bento-grid' target='_blank' rel='noopener noreferrer'>Bento Grid</a> by <a id='linkanimation' href='https://ui.aceternity.com/'>Aceternity</a>
                </span>

                <span className='text'>
                    <a id='linkanimation' href='https://codepen.io/FlorinPop17/pen/yLyzmLZ' target='_blank' rel='noopener noreferrer'>Custom Progress Bar</a> by <a id='linkanimation' href='https://codepen.io/FlorinPop17'>Florin Pop</a>
                </span>

                <span className='text'>
                    <a id='linkanimation' href='https://codepen.io/alvarotrigo/pen/yLxxxJZ' target='_blank' rel='noopener noreferrer'>Diagonal Lines Background Animation Pure CSS</a> by <a id='linkanimation' href='https://codepen.io/alvarotrigo'>Álvaro</a>
                </span>

                <span className="text">
                    <a id="linkanimation" href="https://codepen.io/zzznicob/pen/GRPgKLM" target="_blank" rel="noopener noreferrer">JTB studios - Link</a> by <a id="linkanimation" href="https://codepen.io/zzznicob">Nico</a>
                </span>

                <span className="text">
                    <a id="linkanimation" href="https://codepen.io/ash_creator/pen/JjZReNm" target="_blank" rel="noopener noreferrer">チェックしないと押せないボタン</a> by <a id="linkanimation" href="https://codepen.io/ash_creator">あしざわ - Webクリエイター</a>
                </span>

                <span className="text">
                    Home page design is inspired by <a id="linkanimation" href="https://emailthing.app">emailthing</a>
                </span>
            </div>

            {/* Styles */}
            <style jsx>{`
                #card {
                    width: 80vw; /* Set to 80% of viewport width */
                    height: calc(80vh - 72px); /* Set to 80% of viewport height */
                    background-color: var(--loginFormBackground);
                    border-radius: 20px;
                    padding: 36px;
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    border: 3px solid var(--foreground);
                    z-index: 1;
                    box-sizing: border-box;
                    color: var(--foreground);
                    overflow-y: auto; /* Allow vertical scrolling if needed */
                }
                
                .popup-inner {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    width: 100%;
                }
                
                .title {
                    font-size: 24px;
                    margin-bottom: 20px;
                }
                
                .popup-message {
                    font-size: 18px;
                    margin-bottom: 15px;
                    width: 100%;
                }

                .text {
                    font-size: 16px; /* Adjust font size for text entries */
                    margin-bottom: 10px; /* Space between entries */
                    display: block;
                    text-align: left;
                }

                #linkanimation {
                    text-decoration: none;
                    position: relative;
                }

                #linkanimation::before {
                    position: absolute;
                    content: "";
                    width: 100%;
                    height: 1px;
                    background-color: var(--foreground); /* Underline color */
                    transform: scale(1,1);
                    transition: background-color .5s ease-in-out;
                    bottom: 0px;
                }

                #linkanimation:hover::before {
                    animation: link ease 1s 1 300ms;
                    transform-origin: right;
                }

                @keyframes link {
                    50% {
                        transform: scaleX(0);
                    }
                    50.1% {
                        transform: translateX(-100%) scalex(-0.01);
                    }
                    100% {
                        transform: translateX(-100%) scalex(-1);
                    }
                }

            `}</style>

            </div>
            <div>
              <div className="footer">
              <span className={`footer-text`}>
                Made by <a id="linkanimation" href="https://github.com/Northstrix" target="_blank" rel="noopener noreferrer">Maxim Bortnikov</a> using <a id="linkanimation" href="https://nextjs.org/" target="_blank" rel="noopener noreferrer">Next.js</a> and <a id="linkanimation" href="https://www.perplexity.ai/" target="_blank" rel="noopener noreferrer">Perplexity</a>
              </span>
            </div>
      
            <style jsx>{`
              .text {
                font-weight: bold;
              }
              .split-parent {
                overflow: hidden;
                position: relative;
                z-index: 10;
              }
              .split-child {
                display: inline-block;
                transform: translateY(100%);
                opacity: 0;
                transition: transform 0.9s ease, opacity 0.9s ease;
              }
              .text-emerged .split-child {
                transform: translateY(0);
                opacity: 1;
              }
              .footer {
                position: fixed;
                bottom: 0;
                left: 0;
                z-index: 400;
                right: 0;
                height: 56px;
                background-color: var(--background);
                display: flex;
                justify-content: center; /* Center horizontally */
                align-items: center; /* Center vertically */
                color: var(--foreground);
              }
              .footer-text {
                font-size: 16px;
                letter-spacing: -.0035em;
                text-align: center; /* Center text within its container */
                flex-grow: 1; /* Allow text to grow and take available space */
              }
              #linkanimation {
                text-decoration: none;
                color: var(--foreground);
                position: relative;
              }
              #linkanimation::before {
                position: absolute;
                content: "";
                width: 100%;
                height: 1px;
                background-color: var(--foreground);
                transform: scale(1,1);
                transition: background-color .5s ease-in-out;
                bottom: 0px;
              }
              #linkanimation:hover::before {
                animation: link ease 1s 1 300ms;
                transform-origin: right;
              }
              @keyframes link {
                50% { transform: scaleX(0); }
                50.1% { transform: translateX(-100%) scaleX(-0.01); }
                100% { transform: translateX(-100%) scaleX(-1); }
              }
            `}</style>
            </div>
            </div>
    );
}