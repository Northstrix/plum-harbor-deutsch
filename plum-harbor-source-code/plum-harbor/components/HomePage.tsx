'use client';
import React, { useState, useRef, useEffect } from "react";
import ChronicleButton from '@/components/ui/ChronicleButton/ChronicleButton';
import 'animate.css';
import { useTranslation } from 'react-i18next'; // Import the useTranslation hook
import CLikeInputField from '@/components/ui/CLikeInputField/CLikeInputField'; 
import FileDownloader from '@/components/File-Related/FileDownloader';

const text: string[] = ["PLUM HARBOR"];

interface HomePageProps {
  setShowLogin: (show: boolean) => void; // Function to control login visibility
  setIsRegistering: (isRegistering: boolean) => void; // Function to control registration visibility
}

const HomePage: React.FC<HomePageProps> = ({ setShowLogin, setIsRegistering }) => {
  const { i18n, t } = useTranslation(); // Initialize translation
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [isClient, setIsClient] = useState(false);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [showButton, setShowButton] = useState(false);
  const [showAlternativeInscription, setShowAlternativeInscription] = useState(false);
  const [showTagEntry, setShowTagEntry] = useState(false);
  const [showFooter, setShowFooter] = useState(false);
  const tagEntry = useRef<HTMLInputElement>(null);
  const downloaderRef = useRef<{ initiateDownload?: () => void }>(null);
  const [fileTagForDownloader, setFileTagForDownloader] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const buttonTimer = setTimeout(() => {
      setShowButton(true);
    }, 1300);
    return () => clearTimeout(buttonTimer);
  }, []);

  useEffect(() => {
    const inscriptionTimer = setTimeout(() => {
      setShowAlternativeInscription(true);
    }, 2300); // Adjust the delay as needed
    return () => clearTimeout(inscriptionTimer);
  }, []);

  // Effect for showing tag entry after a delay
  useEffect(() => {
    const tagEntryTimer = setTimeout(() => {
      setShowTagEntry(true);
    }, 2750); // Adjust the delay as needed
    return () => clearTimeout(tagEntryTimer);
  }, []);

  useEffect(() => {
    const footerTimer = setTimeout(() => {
      setShowFooter(true);
    }, 3750);
    return () => clearTimeout(footerTimer);
  }, []);

  // New effect to log changes to 'file-sharing'
  useEffect(() => {
  }, [t('file-sharing')]); // Dependency array includes the translation

  if (!isClient) {
    return null;
  }

  // Function to check for RTL characters
  const containsRtlChars = (text: string): boolean => {
    // RTL Unicode range (e.g., Arabic, Hebrew)
    const rtlCharRegex = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/;
    return rtlCharRegex.test(text);
  };

  // Determine the appropriate class for the span
  const fileSharingText = t('file-sharing');
  const isRtl = containsRtlChars(fileSharingText);
  
  const handleDownload = async () => {
    if (tagEntry.current?.value){
      setFileTagForDownloader(tagEntry.current?.value);
      downloaderRef.current?.initiateDownload?.();
    }
  }

  const handleDownloadComplete = () => {
    setFileTagForDownloader(null);
  }

  return (
    <div className="relative w-screen overflow-hidden flex flex-col justify-start items-center mt-8">
      <div ref={textContainerRef} className="max-w-[1280px] w-full mx-auto px-4 text-center">
        <div className="container flex flex-col justify-center items-center relative z-20 py-10">
          {text.map((line, index) => {
            const delay = index * 0.2;
            return (
              <h1
                key={index}
                className={`text relative inline-block cursor-pointer leading-[1] m-0 font-bold text-center w-full ${!loading ? "text-emerged" : ""}`}
                style={{
                  fontSize: `${Math.max(50, (textContainerRef.current?.clientWidth || 0) * 0.11)}px`,
                  color: 'var(--foreground)',
                  letterSpacing: '-.01em',
                }}
              >
                <div className="split-parent uppercase">
                  <div className="split-child" style={{ transitionDelay: `${delay}s` }}>
                    <div className="multi-color-text">{t('plum-harbor')}</div>
                  </div>
                </div>
              </h1>
            );
          })}
        </div>
        
        {/* Second line of text */}
        <h2 style={{
          fontSize: textContainerRef.current && textContainerRef.current.clientWidth >= 1232 ? (i18n.language === 'he' ? '5.0rem' : '4.5rem') : `${Math.max(36, (textContainerRef.current?.clientWidth || 0) * 0.055)}px`,
          lineHeight: '1.2',
          color: 'var(--foreground)',
          opacity: loading ? '0' : '1',
          transition: 'opacity 1s ease-in-out',
          fontWeight: i18n.language === 'he' ? '400' : '700',
        }}>
          <span>{t('pre-consonant-article-app-in-hebrew')}</span>{" "}
          {isRtl ? (
            <span className="inline-block whitespace-nowrap bg-gradient-to-tr from-[var(--secondThemeColor)] to-[var(--firstThemeColor)] bg-clip-text text-transparent">
              {fileSharingText}
            </span>
          ) : (
            <span className="inline-block whitespace-nowrap bg-gradient-to-br from-[var(--firstThemeColor)] to-[var(--secondThemeColor)] bg-clip-text text-transparent">
              {fileSharingText}
            </span>
          )}{" "}
          {t('app-description-continuation')}
        </h2>
  
        <div className="flex items-center justify-center mt-8">
          <div className="flex flex-wrap justify-center items-center gap-4">
            <div className={`animate__animated ${showButton ? (i18n.language === "he" ? 'animate__fadeInRight' : 'animate__fadeInLeft') : 'opacity-0'}`}>
              <ChronicleButton text={t('get_started')} width="160px" onClick={() => {
                setIsRegistering(true);
                setShowLogin(true);
              }} />
            </div>
          </div>
        </div>
  
        <div className="flex items-center justify-center mt-6">
          <div className="flex flex-wrap justify-center items-center gap-4">
            <div className={`animate__animated ${showAlternativeInscription ? 'animate__fadeIn' : 'opacity-0'}`}>
              <h2 style={{
                fontSize: textContainerRef.current && textContainerRef.current.clientWidth >= 1232 ? '20px' : '18px',
                lineHeight: '1.2',
                color: 'var(--descriptionGray)',
                opacity: loading ? '0' : '1',
                transition: 'opacity 1s ease-in-out',
                fontWeight: i18n.language === 'he' ? '400' : '700',
              }}>
                <span>{t('alternative-to-get-started')}</span>
              </h2>
            </div>
          </div>
        </div>
  
        <div className={`animate__animated ${showTagEntry ? 'animate__zoomIn' : 'opacity-0'}`}>
          <div className="flex items-center justify-center mt-6">
            <div className="flex flex-wrap justify-center items-center gap-3">
              {i18n.language === "he" ? (
                <>
                  <div>
                    <ChronicleButton text={t('download-full')} width="104px" outlined={true} outlinePaddingAdjustment="-2px" onClick={() => {
                      handleDownload()
                    }} />
                  </div>
                  <div>
                    <CLikeInputField ref={tagEntry} placeholder={t('file-tag')} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <CLikeInputField ref={tagEntry} placeholder={t('file-tag')} />
                  </div>
                  <div>
                    <ChronicleButton text={t('download-full')} width="164px" outlined={true} outlinePaddingAdjustment="-2px" onClick={() => {
                      handleDownload()
                    }} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
  
      <div className="footer">
        <span className={`footer-text animate__animated ${showFooter ? 'animate__bounceIn' : 'opacity-0'}`}>
          Made by <a id="linkanimation" href="https://github.com/Northstrix" target="_blank" rel="noopener noreferrer">Maxim Bortnikov</a> using <a id="linkanimation" href="https://nextjs.org/" target="_blank" rel="noopener noreferrer">Next.js</a> and <a id="linkanimation" href="https://www.perplexity.ai/" target="_blank" rel="noopener noreferrer">Perplexity</a>
        </span>
      </div>
  
      <style jsx>{`
        .text { font-weight: bold; }
        .split-parent { overflow: hidden; position: relative; z-index: 10; }
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
          justify-content: center;
          align-items: center;
          color: var(--foreground);
        }
        .footer-text {
          font-size: 16px;
          letter-spacing: -.0035em;
          text-align: center;
          flex-grow: 1;
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
        .multi-color-text {
          font-weight: 700;
          text-transform: uppercase;
          background: linear-gradient(219deg, 
            var(--color-1) 19%, 
            transparent 19%, transparent 20%, 
            var(--color-2) 20%, var(--color-2) 39%,
            transparent 39%, transparent 40%, 
            var(--color-3) 40%, var(--color-3) 59%,
            transparent 59%, transparent 60%, 
            var(--color-4) 60%, var(--color-4) 79%,
            transparent 79%, transparent 80%, 
            var(--color-5) 80%);
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          display: inline-block;
        }
        @keyframes gradientMove {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
  
      {fileTagForDownloader && (
        <FileDownloader
          ref={downloaderRef}
          fileTagForDownloader={fileTagForDownloader}
          onComplete={handleDownloadComplete}
        />
      )}
    </div>
  );
}

export default HomePage;