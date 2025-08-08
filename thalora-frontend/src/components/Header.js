import React from 'react';
import './Header.css';

const Header = () => {
  return (
    <header className="header">
      <div className="container">
        <div className="header__content">
          <div className="header__logo">
            <h1 className="header__title">
              <span className="header__title-main">Thalora</span>
              <span className="header__title-sub">URL Shortener</span>
            </h1>
          </div>
          <div className="header__description">
            <p className="header__tagline">
              Modern, secure, and customizable URL shortening
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;