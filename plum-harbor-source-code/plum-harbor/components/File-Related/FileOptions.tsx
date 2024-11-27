"use client"; 
import React, { useRef, useEffect, useState } from 'react'; 
import ChronicleButton from '@/components/AlwaysDarkModeChronicleButton/AlwaysDarkModeChronicleButton'; 
import "@fontsource/roboto-mono/700.css"; 
import { useTranslation } from 'react-i18next';

interface FileOptionsProps { 
    title: string; 
    color: string; 
    fileSize: string; 
    fullDescription: string; // Added full description prop
    onClose: () => void; // Close function passed from parent
    onDownload: () => void; // Download function passed from parent
    onGetTagFromAllOptions: () => void; // Get Tag function passed from parent
    onSend: () => void; // Send function passed from parent
    onDelete: () => void; // Delete function passed from parent
}

const FileOptions: React.FC<FileOptionsProps> = ({ 
    title, 
    color, 
    fileSize, 
    fullDescription, 
    onClose, 
    onDownload, 
    onGetTagFromAllOptions, 
    onSend, 
    onDelete 
}) => { 
    const containerRef = useRef<HTMLDivElement>(null); 
    const isJavaScriptFile = /\.(js|mjs|cjs|jsx|es6|es)$/i.test(title); 
    const hoverColor = isJavaScriptFile ? '#242424' : 'white'; 
    const displayedTitle = title.length > 41 ? title.slice(0, 38) + '...' : title; 
    const { i18n, t } = useTranslation();
    const innerContainerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(512); //

    useEffect(() => { 
        const checkOverflow = () => {
            if (innerContainerRef.current) {
                const innerContainer = innerContainerRef.current;
                // Check if there is vertical overflow
                if (innerContainer.scrollHeight > innerContainer.clientHeight) {
                    setContainerWidth(522); // Set width to 522px if overflow detected
                } else {
                    setContainerWidth(512); // Set width back to 512px if no overflow
                }
            }
        };

        checkOverflow(); // Check overflow on mount
        window.addEventListener('resize', checkOverflow); // Check overflow on window resize

        return () => {
            window.removeEventListener('resize', checkOverflow); // Cleanup listener
        };
    }, [fullDescription]); // Re-run when fullDescription changes
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

    // Button texts based on language
    const buttonsTop = i18n.language === "he" 
    ? [t('send'), t('get-tag'), t('download')] 
    : [t('download'), t('get-tag'), t('send')];

    return ( 
        <div className="overlay"> 
            <div ref={containerRef} className="file-container" style={{ '--file-color': color, width: `${containerWidth}px` } as React.CSSProperties}> 
            <div ref={innerContainerRef} className="inner-container"> 
                    <div className="content"> 
    
                        <h1 className="text"> 
                            <span className="title" title={title}>{displayedTitle}</span> 
                            <span className="text-effect" style={{ backgroundColor: color }}></span> 
                        </h1> 
    
                        <p className="filesize">{fileSize}</p> 
    
                        {/* Conditional rendering for description */}
                        <p className="full-description">
                            {fullDescription}
                        </p> 
    
                        <div className="button-container top-buttons"> 
                            {buttonsTop.map((text) => (
                                <ChronicleButton key={text} text={text} width="136px" onClick={() => {
                                    switch (text) {
                                        case t('download'):
                                            onDownload();
                                            break;
                                        case t('get-tag'):
                                            onGetTagFromAllOptions();
                                            break;
                                        case t('send'):
                                            onSend();
                                            break;
                                        default:
                                            break;
                                    }
                                }} outlined={false} />
                            ))}
                        </div>

                        {/* Bottom button container */}
                        <div className="button-container bottom-buttons">
                            {i18n.language === "he" ? (
                                <>
                                    <ChronicleButton 
                                        key="close" 
                                        text={t('close')} 
                                        width="136px" 
                                        onClick={onClose} 
                                        outlined={true} // Assuming you want the close button to be outlined
                                    />
                                    <ChronicleButton 
                                        key="delete" 
                                        text={t('delete')} 
                                        width="136px" 
                                        hoverColor="var(--deleteChronicleButtonColor)" 
                                        onClick={onDelete} 
                                        outlined={false} // Not outlined for delete button
                                    />
                                </>
                            ) : (
                                <>
                                    <ChronicleButton 
                                        key="delete" 
                                        text={t('delete')} 
                                        width="136px" 
                                        hoverColor="var(--deleteChronicleButtonColor)" 
                                        onClick={onDelete} 
                                        outlined={false} // Not outlined for delete button
                                    />
                                    <ChronicleButton 
                                        key="close" 
                                        text={t('close')} 
                                        width="136px" 
                                        onClick={onClose} 
                                        outlined={true} // Assuming you want the close button to be outlined
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
        .button-container { display: flex; justify-content: center; gap: 12px;} // Space between buttons
        .top-buttons {
            margin-bottom: 12px;
        }
                .file-container { --rotation: 2.5rad; border: 2px solid transparent; border-radius: var(--generalBorderRadius); background-image: linear-gradient(var(--loginFormBackground), var(--loginFormBackground)), linear-gradient(var(--rotation), var(--file-color), var(--file-color) 20%, var(--sharedFilesSecondColor) 80%, var(--sharedFilesSecondColor)); background-origin: border-box; background-clip: padding-box, border-box; position: relative; overflow: hidden; padding: 14px; } 

                .inner-container { width: 100%; max-height: 50vh; overflow-y: auto; background-color: black; border-radius: var(--generalBorderRadius); } 
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
          padding-top: 16px;
          padding-bottom: 16px;
        }
        .full-description {
          font-size: 16px;
          color: white;
          padding-bottom: 18px;
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
        </div> ); 
}; 

export default FileOptions;