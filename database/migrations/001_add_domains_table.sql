-- Migration 001: Add domains table for custom domain support
-- Created: 2025-01-XX
-- Description: Adds the domains table to support custom domain functionality

USE TaloraDB;
GO

-- Create domains table for storing custom domains
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'domains')
BEGIN
    CREATE TABLE domains (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NULL, -- nullable foreign key for future user system
        domain_name NVARCHAR(255) NOT NULL UNIQUE,
        is_verified BIT NOT NULL DEFAULT 0,
        verification_token NVARCHAR(255) NULL, -- token for DNS TXT record verification
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        updated_at DATETIME2 DEFAULT GETUTCDATE()
    );
    
    -- Index for faster lookups by domain_name
    CREATE INDEX IX_domains_domain_name ON domains(domain_name);
    
    -- Index for user_id lookups when user system is implemented
    CREATE INDEX IX_domains_user_id ON domains(user_id);
    
    -- Index for verified domains
    CREATE INDEX IX_domains_verified ON domains(is_verified);
    
    -- Index for verification tokens
    CREATE INDEX IX_domains_verification_token ON domains(verification_token);

    PRINT 'Domains table and indexes created successfully.';
END
ELSE
BEGIN
    PRINT 'Domains table already exists.';
END
GO