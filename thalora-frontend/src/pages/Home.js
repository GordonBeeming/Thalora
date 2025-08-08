import React, { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import URLForm from '../components/URLForm';
import URLDisplay from '../components/URLDisplay';
import './Home.css';

const Home = () => {
  const [shortenedUrl, setShortenedUrl] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Mock URL shortening function - in real app this would call backend API
  const generateMockShortenedUrl = (url) => {
    // Generate a random short ID
    const shortId = Math.random().toString(36).substring(2, 8);
    return `https://thalora.co/${shortId}`;
  };

  const handleUrlSubmit = async (url) => {
    setIsLoading(true);
    setOriginalUrl(url);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock the shortened URL generation
      const shortened = generateMockShortenedUrl(url);
      setShortenedUrl(shortened);
    } catch (error) {
      console.error('Error shortening URL:', error);
      // In a real app, you'd show an error message to the user
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySuccess = () => {
    // This could trigger analytics or show a toast notification
    console.log('URL copied to clipboard successfully');
  };

  return (
    <div className="home">
      <Header />
      
      <main className="home__main">
        <div className="container">
          <div className="home__content">
            <div className="home__form-section">
              <div className="home__form-container">
                <URLForm 
                  onSubmit={handleUrlSubmit} 
                  isLoading={isLoading}
                />
                
                {(shortenedUrl || isLoading) && (
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
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Home;