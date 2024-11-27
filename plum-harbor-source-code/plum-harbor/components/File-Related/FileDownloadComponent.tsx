"use client";
import React, { useRef, useEffect, useState } from 'react';
import ChronicleButton from '@/components/AlwaysDarkModeChronicleButton/AlwaysDarkModeChronicleButton';
import "@fontsource/roboto-mono/700.css";
import { useTranslation } from 'react-i18next';

interface Container {
  id: string;
  title: string;
  color: string;
  fileSize: string;
  description: string;
  metadataIntegrity: boolean;
}

interface FileDownloadComponentProps {
  container: Container;
  messages: string[];
  fileUrl: string | null;
  onSave: (() => void) | null;
  onClose: () => void;
}

const FileDownloadComponent: React.FC<FileDownloadComponentProps> = ({ 
  container, 
  messages, 
  fileUrl, 
  onSave, 
  onClose 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(512);
  const { i18n, t } = useTranslation();

  const isJavaScriptFile = /\.(js|mjs|cjs|jsx|es6|es)$/i.test(container.title);
  const hoverColor = isJavaScriptFile ? '#242424' : 'white';
  const displayedTitle = container.title.length > 41 ? container.title.slice(0, 38) + '...' : container.title;

  useEffect(() => {
    const checkOverflow = () => {
      if (innerContainerRef.current) {
        const innerContainer = innerContainerRef.current;
        if (innerContainer.scrollHeight > innerContainer.clientHeight) {
          setContainerWidth(522);
        } else {
          setContainerWidth(512);
        }
      }
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => {
      window.removeEventListener('resize', checkOverflow);
    };
  }, [container.description]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const angle = Math.atan2(-x, y);
      container.style.setProperty("--rotation", `${angle}rad`);
    };
    container.addEventListener("mousemove", handleMouseMove);
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className="overlay">
      <div ref={containerRef} className="file-container" style={{ '--file-color': container.color, width: `${containerWidth}px` } as React.CSSProperties}>
        <div ref={innerContainerRef} className="inner-container">
          <div className="content">
            <h1 className="text">
              <span className="title" title={container.title}>{displayedTitle}</span>
              <span className="text-effect" style={{ backgroundColor: container.color }}></span>
            </h1>
            <p className="filesize">{container.fileSize}</p>
            <p className="full-description">{container.description}</p>
            <div className="messages-container">
              {messages.map((message, index) => (
                <p key={index} className="message">{message}</p>
              ))}
            </div>
            <div className="button-container bottom-buttons">
                {i18n.language === "he" ? (
                    <>
                    <ChronicleButton 
                        key="close" 
                        text={t('close')} 
                        width="136px" 
                        onClick={onClose} 
                        outlined={true}
                    />
                    {fileUrl && onSave && (
                        <ChronicleButton 
                        key="save-as" 
                        text={t('save-as')} 
                        width="136px" 
                        onClick={onSave} 
                        outlined={false}
                        />
                    )}
                    </>
                ) : (
                    <>
                    {fileUrl && onSave && (
                        <ChronicleButton 
                        key="save-as" 
                        text={t('save-as')} 
                        width="196px" 
                        onClick={onSave} 
                        outlined={false}
                        />
                    )}
                    <ChronicleButton 
                        key="close" 
                        text={t('close')} 
                        width="196px" 
                        onClick={onClose} 
                        outlined={true}
                    />
                    </>
                )}
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        .button-container {
          display: flex;
          justify-content: center;
          gap: 14px;
          margin-top: 12px;
        }
        .file-container {
          --rotation: 2.5rad;
          border: 2px solid transparent;
          border-radius: var(--generalBorderRadius);
          background-image: linear-gradient(var(--loginFormBackground), var(--loginFormBackground)), linear-gradient(var(--rotation), var(--file-color), var(--file-color) 20%, var(--sharedFilesSecondColor) 80%, var(--sharedFilesSecondColor));
          background-origin: border-box;
          background-clip: padding-box, border-box;
          position: relative;
          overflow: hidden;
          padding: 14px;
        }
        .inner-container {
          width: 100%;
          max-height: 50vh;
          overflow-y: auto;
          background-color: black;
          border-radius: var(--generalBorderRadius);
        }
        .content {
          position: relative;
          z-index: 20;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
          padding: 20px 16px;
        }
        .content::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(45deg, rgba(230, 230, 230, 0.3) 25%, transparent 25%, transparent 75%, rgba(240, 240, 240, 0.3) 75%), linear-gradient(-45deg, rgba(240, 240, 240, 0.3) 25%, transparent 25%, transparent 75%, rgba(230, 230, 230, 0.3) 75%);
          background-size: 20px 20px;
          opacity: 0.5;
          z-index: -1;
        }
        .text {
          font-size: 20px;
          font-weight: bold;
          letter-spacing: var(--titleWithFancyHoverEffectLetterSpacing);
          line-height: normal;
          margin-bottom: -1px;
          width: auto;
          color: ${container.color};
          transition: color 0.3s ease;
          position: relative;
          overflow: hidden;
          cursor: pointer;
        }
        .text:hover {
          color: ${hoverColor} !important;
        }
        .title {
          position: relative;
          z-index: 10;
          font-size: var(--titleWithFancyHoverEffectTextSize);
          padding: 2px 4px;
        }
        .text-effect {
          clip-path: polygon(0 50%, 100% 50%, 100% 50%, 0 50%);
          transform-origin: center;
          transition: all cubic-bezier(.1,.5,.5,1) 0.4s;
          position: absolute;
          left: -4px;
          right: -4px;
          top: -4px;
          bottom: -4px;
          z-index: 0;
        }
        .text:hover > .text-effect {
          clip-path: polygon(0 0, 100% 0, 100% 100%, 0% 100%);
        }
        .filesize {
          font-size: 16px;
          color: white;
          padding-top: 16px;
          padding-bottom: 16px;
        }
        .full-description, .message {
          font-size: 16px;
          color: white;
          padding-bottom: 18px;
        }
        .messages-container {
          margin-bottom: 12px;
        }
      `}</style>
    </div>
  );
};

export default FileDownloadComponent;