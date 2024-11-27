// components/Disclaimer.tsx
"use client"
import React, { useState } from 'react';

interface DisclaimerProps {
  onAccept: () => void;
}

const Disclaimer: React.FC<DisclaimerProps> = ({ onAccept }) => {
  const [isChecked, setIsChecked] = useState(false);

  const handleCheckboxChange = () => {
    setIsChecked(!isChecked);
  };

  const handleButtonClick = () => {
    if (isChecked) {
      onAccept();
      localStorage.setItem('acceptedDisclaimer', 'true');
    }
  };

  return (
    <div className="disclaimer-container background-image">
      <div className="disclaimer-content">
        <h2>WICHTIGER HINWEIS</h2>
        <p>
          Trotz gut funktionierender kryptografischer Primitiven ist diese Webanwendung (Dienst) möglicherweise nicht zuverlässig.
        </p>
        <strong>
          <p>
            Diese Anwendung wird ohne Gewährleistung oder Garantien jeglicher Art bereitgestellt.
          </p>
          <p>
            Sie kann unentdeckte Schwachstellen oder Fehler enthalten.
          </p>
        </strong>
        <p>
          Diese App kann jederzeit nicht funktionsfähig werden oder ohne vorherige Ankündigung eingestellt werden.
        </p>
        <p>
          Diese App dient ausschließlich zu Bildungs- und Demonstrationszwecken!
        </p>
        <p className="warning">BENUTZEN SIE ES AUF EIGENES RISIKO!!!</p>
        <div className="normalButton">
          <input type="checkbox" id="nb-check" checked={isChecked} onChange={handleCheckboxChange} />
          <label htmlFor="nb-check" className="normalButton__check">
            Ich verstehe und bin damit einverstanden
          </label>
          <button onClick={handleButtonClick} className="normalButton__button">
            {isChecked ? 'Fortfahren' : 'Einen Moment bitte'}
          </button>
        </div>
      </div>
      <style jsx>{`
        .disclaimer-container {
          position: fixed;
          inset: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
        }
        .disclaimer-content {
          width: 484px;
          max-width: 90%;
          background: var(--loginFormBackground);
          border-radius: var(--loginFormBorderRadius);
          padding: 20px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          border: 3px solid var(--foreground);
          color: var(--foreground);
        }
        h2 {
          margin: 5px 0;
          color: var(--foreground);
          font-size: 1.5rem;
          font-weight: bold;
        }
        p {
          margin: 6px 0;
          line-height: 1.44;
        }
        .warning {
          font-weight: bold;
          color: var(--generalErrorColor);
          margin: 6px 0;
          font-size: 1.2rem;
        }
        strong {
          color: var(--foreground);
        }
        #nb-check {
          display: none;
        }
        .normalButton {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: relative;
          z-index: 0;
          width: 100%;
          margin: 10px 0 0;
        }
        .normalButton::before {
          content: '';
          position: absolute;
          z-index: 2;
          bottom: 0;
          left: 0;
          right: 0;
          margin: 0 auto;
          width: 100%;
          height: 100%;
        }
        .normalButton__check {
          position: relative;
          z-index: 3;
          display: inline-block;
          font-size: 14px;
          padding: 14px 16px 14px 40px;
          margin-bottom: 6px;
          border-radius: 3px;
          cursor: pointer;
          color: var(--foreground);
          background: var(--middleThemeColor);
          transition: all ease .3s;
        }
        .normalButton__check::before {
          content: '';
          position: absolute;
          top: 0;
          left: 8px;
          bottom: 0;
          margin: auto 0;
          width: 20px;
          height: 20px;
          border-radius: 2px;
          background: var(--foreground);
        }
        .normalButton__check::after {
          content: '';
          position: absolute;
          top: 23px;
          left: 9px;
          width: 0;
          height: 0;
          overflow: hidden;
          box-sizing: border-box;
          border-left: solid 4px var(--middleThemeColor);
          border-bottom: solid 4px var(--middleThemeColor);
          opacity: 0;
          transform-origin: top left;
          transform: rotate(-45deg);
        }
        #nb-check:checked ~ .normalButton__check::after {
          animation: check ease .3s;
          animation-fill-mode: forwards;
        }
        #nb-check:checked ~ .normalButton__check {
          color: var(--foreground);
          background: var(--descriptionGray);
        }
        @keyframes check {
          0%  { width: 0; height: 0; opacity: 0; }
          30% { width: 0; height: 10px; opacity: 1; }
          100%{ width: 16px; height: 10px; opacity: 1; }
        }
        .normalButton__button {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 280px;
          min-height: 64px;
          font-size: 16px;
          border-radius: 8px;
          font-weight: bold;
          background-color: transparent;
          border: none;
          text-decoration: none;
          box-sizing: border-box;
          padding: 8px 48px;
          color: var(--foreground);
          background: var(--middleThemeColor);
          transition: all ease .3s;
          overflow: hidden;
          cursor: pointer;
        }
        .normalButton__button::before {
          content: 'Einen Moment bitte';
          display: flex;
          justify-content: center;
          align-items: center;
          position: absolute;
          z-index: 1;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: 8px;
          color: var(--middleThemeColor);
          background: var(--foreground);
          transition: all ease .7s;
        }
        .normalButton__button::after {
          content: '';
          position: absolute;
          top: 0;
          right: 32px;
          bottom: 0;
          margin: auto 0;
          width: 10px;
          height: 10px;
          box-sizing: border-box;
          border-top: solid 3px var(--foreground);
          border-right: solid 3px var(--foreground);
          transform: rotate(45deg);
          transition: all ease .3s;
        }
        #nb-check:checked ~ .normalButton__button::before {
          left: 100%;
        }
        #nb-check:checked ~ .normalButton__button {
          z-index: 3;
        }
        #nb-check:checked ~ .normalButton__button:hover {
          background: #8856FF;
        }
        #nb-check:checked ~ .normalButton__button:hover::after {
          right: 24px;
        }
      `}</style>
    </div>
  );
};

export default Disclaimer;