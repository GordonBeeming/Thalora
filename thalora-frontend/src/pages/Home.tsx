import React, { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import URLForm from '../components/URLForm';
import URLDisplay from '../components/URLDisplay';
import DomainManager from '../components/DomainManager';
import { shortenUrl, ThaloriApiError } from '../services/api';
import './Home.css';

const Home: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'shorten' | 'domains'>('shorten');
  const [shortenedUrl, setShortenedUrl] = useState<string>('');
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleUrlSubmit = async (url: string): Promise<void> => {
    setIsLoading(true);
    setError('');
    setOriginalUrl(url);
    setShortenedUrl(''); // Clear previous result
    
    try {
      const response = await shortenUrl(url);
      setShortenedUrl(response.short_url);
    } catch (error) {
      console.error('Error shortening URL:', error);
      
      if (error instanceof ThaloriApiError) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySuccess = (): void => {
    // This could trigger analytics or show a toast notification
    console.log('URL copied to clipboard successfully');
  };

  const handleDomainAdded = (): void => {
    // Optionally switch back to shortening tab or show a notification
    console.log('Domain added successfully');
  };

  return (
    <div className="home">
      <Header />
      
      <main className="home__main">
        <div className="container">
          <div className="home__content">
            {/* Tab Navigation */}
            <div className="home__tabs">
              <button
                className={`home__tab ${activeTab === 'shorten' ? 'home__tab--active' : ''}`}
                onClick={() => setActiveTab('shorten')}
              >
                <span className="home__tab-icon">🔗</span>
                Shorten URLs
              </button>
              <button
                className={`home__tab ${activeTab === 'domains' ? 'home__tab--active' : ''}`}
                onClick={() => setActiveTab('domains')}
              >
                <span className="home__tab-icon">🌐</span>
                Manage Domains
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'shorten' ? (
              <>
                <div className="home__form-section">
                  <div className="home__form-container">
                    <URLForm 
                      onSubmit={handleUrlSubmit} 
                      isLoading={isLoading}
                    />
                    
                    {error && (
                      <div className="home__error">
                        <div className="error-message slide-in">
                          <span>⚠️</span>
                          {error}
                        </div>
                      </div>
                    )}
                    
                    {(shortenedUrl || isLoading) && !error && (
                      <div className="home__result-section">
                        {isLoading ? (
                          <div className="home__loading">
                            <div className="loading-spinner"></div>
                            <p className="loading-text">Creating your short URL...</p>
                          </div>
                        ) : (
                          <URLDisplay
                            originalUrl={originalUrl}
                            shortenedUrl={shortenedUrl}
                            onCopySuccess={handleCopySuccess}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="home__info-section">
                  <div className="home__features">
                    <div className="home__feature">
                      <div className="home__feature-icon">🚀</div>
                      <h3 className="home__feature-title">Lightning Fast</h3>
                      <p className="home__feature-description">
                        Get your shortened URLs instantly with our high-performance infrastructure
                      </p>
                    </div>
                    
                    <div className="home__feature">
                      <div className="home__feature-icon">🔒</div>
                      <h3 className="home__feature-title">Secure & Private</h3>
                      <p className="home__feature-description">
                        Your data is protected with enterprise-grade security and privacy controls
                      </p>
                    </div>
                    
                    <div className="home__feature">
                      <div className="home__feature-icon">🎯</div>
                      <h3 className="home__feature-title">Custom Domains</h3>
                      <p className="home__feature-description">
                        Use your own domain for branded short links that build trust
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="home__domain-section">
                <DomainManager onDomainAdded={handleDomainAdded} />
              </div>
            )}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Home;