"use client";

import React, { useRef, useEffect } from 'react';
import ChronicleButton from '@/components/AlwaysDarkModeChronicleButton/AlwaysDarkModeChronicleButton';
import "@fontsource/roboto-mono/700.css";

interface FileTagPopupProps {
  id: string;
  title: string;
  color: string;
  fileSize: string;
  fileTag: string;
  onClose: () => void;
}

const FileTagPopup: React.FC<FileTagPopupProps> = ({ title, color, fileSize, fileTag, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isJavaScriptFile = /\.(js|mjs|cjs|jsx|es6|es)$/i.test(title);
  const hoverColor = isJavaScriptFile ? '#242424' : 'white';
  const displayedTitle = title.length > 41 ? title.slice(0, 38) + '...' : title; 

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
      <div 
        ref={containerRef}
        className="file-container"
        style={{ 
        '--file-color': color,
          fontFamily: "'Roboto Mono', monospace",
        } as React.CSSProperties}
      >
        <div className="inner-container">
          <div className="content">
            <h1 className="text">
            <span className="title" title={title}>{displayedTitle}</span>
              <span className="text-effect" style={{ backgroundColor: color }}></span>
            </h1>
            <p className="filesize">{fileSize}</p>
            <div className="tag-container">
              <p className="tag-label">Tag:</p>
              <input
                type="text"
                readOnly
                value={fileTag}
                className="tag-input"
              />
            </div>
            <div className="button-container">
              <ChronicleButton text="OK" width="100px" onClick={onClose} outlined={true} outlinePaddingAdjustment="5px"/>
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
        .file-container {
          --rotation: 2.5rad;
          width: 512px;
          height: 254px;
          border: 2px solid transparent;
          border-radius: var(--generalBorderRadius);
          background-image: linear-gradient(var(--loginFormBackground), var(--loginFormBackground)),
                            linear-gradient(var(--rotation), var(--file-color), var(--file-color) 20%, var(--sharedFilesSecondColor) 80%, var(--sharedFilesSecondColor));
          background-origin: border-box;
          background-clip: padding-box, border-box;
          position: relative;
          overflow: hidden;
          padding: 14px;
        }
        .inner-container {
          width: 100%;
          height: 100%;
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
          letter-spacing: var(--titleWithFancyHoverEffectLetterSpacing);
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
          padding-top: 14px;
          padding-bottom: 14px;
        }
        .tag-container {
          display: flex;
          align-items: center;
          margin-bottom: 14px;
        }
        .tag-label {
          color: var(--constantFileProcessingPopUpWhite);
          margin-right: 10px;
        }
        .tag-input {
          flex-grow: 1;
          padding: 10px;
          border: 1px solid var(--alwaysDarkModeForeground);
          border-radius: var(--generalBorderRadius);
          font-size: 14px;
          font-weight: 700;
          background-color: var(--alwaysDarkModeForeground);
          color: var(--alwaysDarkModeNegativeForeground);
        }
        .button-container {
          display: flex;
          justify-content: center;
        }
      `}</style>
    </div>
  );
};

export default FileTagPopup;