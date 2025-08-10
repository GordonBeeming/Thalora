import React, { useState, useEffect } from 'react';
import { DomainEntry, addDomain, listDomains, verifyDomain, ThaloraApiError } from '../services/api';
import './DomainManager.css';

interface DomainManagerProps {
  onDomainAdded?: () => void;
}

const DomainManager: React.FC<DomainManagerProps> = ({ onDomainAdded }) => {
  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [newDomainName, setNewDomainName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingDomains, setIsLoadingDomains] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [verifyingDomainId, setVerifyingDomainId] = useState<number | null>(null);

  // Load domains on component mount
  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async (): Promise<void> => {
    try {
      setIsLoadingDomains(true);
      const fetchedDomains = await listDomains();
      setDomains(fetchedDomains);
    } catch (error) {
      console.error('Error fetching domains:', error);
      setError(error instanceof ThaloraApiError ? error.message : 'Failed to load domains');
    } finally {
      setIsLoadingDomains(false);
    }
  };

  const handleAddDomain = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!newDomainName.trim()) {
      setError('Please enter a domain name');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await addDomain(newDomainName.trim());
      setSuccessMessage(response.verification_status);
      setNewDomainName('');

      // Refresh the domains list
      await fetchDomains();

      if (onDomainAdded) {
        onDomainAdded();
      }
    } catch (error) {
      console.error('Error adding domain:', error);
      setError(error instanceof ThaloraApiError ? error.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyDomain = async (domainId: number): Promise<void> => {
    setVerifyingDomainId(domainId);
    setError('');
    setSuccessMessage('');

    try {
      const response = await verifyDomain(domainId);
      setSuccessMessage(response.verification_status);
      await fetchDomains(); // Refresh the list
    } catch (error) {
      console.error('Error verifying domain:', error);
      setError(error instanceof ThaloraApiError ? error.message : 'An unexpected error occurred during verification');
    } finally {
      setVerifyingDomainId(null);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const clearMessages = (): void => {
    setError('');
    setSuccessMessage('');
  };

  return (
    <div className="domain-manager">
      <div className="domain-manager__header">
        <h2 className="domain-manager__title">Manage Custom Domains</h2>
        <p className="domain-manager__description">
          Add your own domains to create branded short URLs
        </p>
      </div>

      {/* Add Domain Form */}
      <div className="domain-manager__form-section">
        <form onSubmit={handleAddDomain} className="domain-form">
          <div className="domain-form__input-group">
            <input
              type="text"
              value={newDomainName}
              onChange={(e) => {
                setNewDomainName(e.target.value);
                clearMessages();
              }}
              placeholder="Enter domain (e.g., myshortener.com)"
              className="domain-form__input"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="domain-form__submit-btn"
              disabled={isLoading || !newDomainName.trim()}
            >
              {isLoading ? (
                <>
                  <span className="domain-form__spinner"></span>
                  Adding...
                </>
              ) : (
                'Add Domain'
              )}
            </button>
          </div>
        </form>

        {/* Messages */}
        {error && (
          <div className="domain-manager__message domain-manager__message--error">
            <span className="domain-manager__message-icon">⚠️</span>
            {error}
          </div>
        )}

        {successMessage && (
          <div className="domain-manager__message domain-manager__message--success">
            <span className="domain-manager__message-icon">✅</span>
            <div>
              <strong>Domain added successfully!</strong>
              <br />
              {successMessage}
            </div>
          </div>
        )}
      </div>

      {/* Domains List */}
      <div className="domain-manager__list-section">
        <h3 className="domain-manager__list-title">Your Domains</h3>

        {isLoadingDomains ? (
          <div className="domain-manager__loading">
            <span className="domain-manager__spinner"></span>
            Loading domains...
          </div>
        ) : domains.length === 0 ? (
          <div className="domain-manager__empty">
            <div className="domain-manager__empty-icon">🌐</div>
            <p className="domain-manager__empty-text">
              No domains added yet. Add your first domain above to get started.
            </p>
          </div>
        ) : (
          <div className="domain-list">
            {domains.map((domain) => (
              <div key={domain.id} className="domain-list__item">
                <div className="domain-list__main">
                  <div className="domain-list__name">
                    {domain.domain_name}
                  </div>
                  <div className={`domain-list__status domain-list__status--${domain.is_verified ? 'verified' : 'pending'}`}>
                    {domain.is_verified ? (
                      <>
                        <span className="domain-list__status-icon">✅</span>
                        Verified
                      </>
                    ) : (
                      <>
                        <span className="domain-list__status-icon">⏳</span>
                        Pending Verification
                      </>
                    )}
                  </div>
                </div>
                <div className="domain-list__meta">
                  <span className="domain-list__date">
                    Added {formatDate(domain.created_at)}
                  </span>
                </div>
                {!domain.is_verified && (
                  <div className="domain-list__verification">
                    <p className="domain-list__verification-text">
                      To verify ownership, create a TXT record:
                    </p>
                    <div className="domain-list__dns-record">
                      <strong>Host:</strong> _thalora-verification.{domain.domain_name}<br />
                      <strong>Value:</strong> {domain.verification_token || 'Token not available'}
                    </div>
                    <button
                      className="domain-list__verify-btn"
                      onClick={() => handleVerifyDomain(domain.id)}
                      disabled={verifyingDomainId === domain.id}
                    >
                      {verifyingDomainId === domain.id ? (
                        <>
                          <span className="domain-form__spinner"></span>
                          Verifying...
                        </>
                      ) : (
                        'Verify Now'
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DomainManager;