"use client";
import React, { useRef, useEffect } from 'react';
import ChronicleButton from '@/components/AlwaysDarkModeChronicleButton/AlwaysDarkModeChronicleButton';
import "@fontsource/roboto-mono/700.css";
import { useTranslation } from 'react-i18next'; // Import the useTranslation hook and i18n

interface FileContainerProps {
  id: string;
  title: string;
  color: string;
  fileSize: string;
  description: string;
  onGetTag: (id: string) => void;
  onShowAllOptions: (id: string) => void;
  onTitleClick: (id: string) => void;
  onDescriptionClick: (id: string) => void;
  metadataIntegrity?: boolean;
}

const FileContainer: React.FC<FileContainerProps> = ({
  id,
  title,
  color,
  fileSize,
  description,
  onGetTag,
  onShowAllOptions,
  onTitleClick,
  onDescriptionClick,
  metadataIntegrity
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isJavaScriptFile = /\.(js|mjs|cjs|jsx|es6|es)$/i.test(title);
  const hoverColor = isJavaScriptFile ? '#242424' : 'white';
  const displayedTitle = title.length > 27 ? title.slice(0, 24) + '...' : title;
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.style.setProperty('--backgroundGradient', backgroundGradient);
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

  // Determine the background gradient based on metadataIntegrity
  const backgroundGradient = metadataIntegrity
      ? `linear-gradient(var(--rotation), var(--sharedFilesDefaultColor), var(--sharedFilesDefaultColor) 20%, var(--sharedFilesSecondColor) 80%, var(--sharedFilesSecondColor))`
      : `linear-gradient(var(--rotation), var(--generalErrorColor), var(--generalErrorColor))`; // Use --generalErrorColor for both colors when metadataIntegrity is false
      
  const buttonFontFamily = isRTL 
      ? '"Arial", "Alef", sans-serif' 
      : '"Roboto Mono", monospace';

  return (
    <div className="file-container" ref={containerRef} style={{ fontFamily: "'Roboto Mono', monospace" }}>
      <div className="inner-container">
        <div className="content">
          <h1 className="text" onClick={() => onTitleClick(id)}>
            <span className="title" title={title}>{displayedTitle}</span>
            <span className="text-effect" style={{ backgroundColor: color }}></span>
          </h1>
          <p className="filesize">{fileSize}</p>
          <p className="description" onClick={() => onDescriptionClick(id)}>{description}</p>
          <div className="button-container">
          {isRTL ? (
            <>
              <ChronicleButton 
                text={t('all-options')} 
                outlined={true} 
                width="136px" 
                onClick={() => onShowAllOptions(id)} 
                fontFamily={buttonFontFamily} // Pass font family directly
              />
              <ChronicleButton 
                text={t('get-tag')} 
                width="136px" 
                onClick={() => onGetTag(id)} 
                fontFamily={buttonFontFamily} // Pass font family directly
              />
            </>
          ) : (
            <>
              <ChronicleButton 
                text={t('get-tag')} 
                width="136px" 
                onClick={() => onGetTag(id)} 
                fontFamily={buttonFontFamily} // Pass font family directly
              />
              <ChronicleButton 
                text={t('all-options')} 
                outlined={true} 
                width="136px" 
                onClick={() => onShowAllOptions(id)} 
                fontFamily={buttonFontFamily} // Pass font family directly
              />
            </>
          )}
          </div>
        </div>
      </div>
      <style jsx>{`
        .file-container {
          --rotation: 2.5rad;
          width: 352px;
          height: 352px;
          border: 2px solid transparent;
          border-radius: var(--generalBorderRadius);
          background-image: linear-gradient(var(--loginFormBackground), var(--loginFormBackground)), 
                            var(--backgroundGradient); /* Use the CSS variable for the gradient */
          background-origin: border-box;
          background-clip: padding-box, border-box;
          position: relative;
          overflow: hidden;
          font-family: 'Roboto Mono', monospace;
          padding: 14px;
        }
        .inner-container {
          width: 320px;
          height: 320px;
          background-color: black;
          border-radius: var(--generalBorderRadius);
          overflow: hidden;
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
          background: linear-gradient(45deg, rgba(230, 230, 230, 0.3) 25%, transparent 25%, transparent 75%, rgba(240, 240, 240, 0.3) 75%), 
                      linear-gradient(-45deg, rgba(240, 240, 240, 0.3) 25%, transparent 25%, transparent 75%, rgba(230, 230, 230, 0.3) 75%);
          background-size: 20px 20px;
          opacity: 0.5;
          z-index: -1;
        }
        .text {
          font-size: 20px;
          font-weight: bold;
          letter-spacing: -.01em;
          line-height: normal;
          margin-bottom: -1px;
          width: auto;
          color: ${color};
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
          font-size: 17.6px;
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
        }
        .description {
          font-size: 17px;
          color: white;
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
          cursor: pointer;
          padding-top: 8px;
        }
        .button-container {
          display: flex;
          justify-content: center;
          gap: 10px;
          padding-top: 16px;
        }
      `}</style>
    </div>
  );
};

export default FileContainer;