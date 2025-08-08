import React from 'react';
import './Footer.css';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__content">
          <div className="footer__info">
            <p className="footer__copyright">
              © {currentYear} Thalora. Built with React.
            </p>
            <p className="footer__description">
              A modern, secure, and customizable URL shortener designed for simplicity and performance.
            </p>
          </div>
          <div className="footer__features">
            <div className="footer__feature">
              <span className="footer__feature-icon">🔒</span>
              <span className="footer__feature-text">Secure</span>
            </div>
            <div className="footer__feature">
              <span className="footer__feature-icon">⚡</span>
              <span className="footer__feature-text">Fast</span>
            </div>
            <div className="footer__feature">
              <span className="footer__feature-icon">🎨</span>
              <span className="footer__feature-text">Customizable</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;