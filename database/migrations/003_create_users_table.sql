-- Migration 003: Create users table for passkey authentication
-- Created: 2025-01-11
-- Description: Creates the users table to support passkey-based authentication

-- Create users table for storing user accounts with passkey authentication
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
    CREATE TABLE users (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        username NVARCHAR(255) NOT NULL UNIQUE,
        email NVARCHAR(320) NOT NULL UNIQUE,
        passkey_public_key VARBINARY(MAX) NOT NULL,
        passkey_credential_id VARBINARY(MAX) NOT NULL UNIQUE,
        passkey_counter BIGINT NOT NULL DEFAULT 0,
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        updated_at DATETIME2 DEFAULT GETUTCDATE()
    );
    
    -- Index for faster lookups by username
    CREATE INDEX IX_users_username ON users(username);
    
    -- Index for faster lookups by email  
    CREATE INDEX IX_users_email ON users(email);
    
    -- Index for faster lookups by credential ID (used in WebAuthn authentication)
    CREATE INDEX IX_users_credential_id ON users(passkey_credential_id);
    
    -- Index for created_at for analytics and sorting
    CREATE INDEX IX_users_created_at ON users(created_at);
    
    PRINT 'Users table and indexes created successfully.';
END
ELSE
BEGIN
    PRINT 'Users table already exists.';
END
GO

-- Update domains table to reference users (foreign key relationship)
-- Add foreign key constraint if not already present
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_domains_user_id')
BEGIN
    ALTER TABLE domains
    ADD CONSTRAINT FK_domains_user_id 
    FOREIGN KEY (user_id) REFERENCES users(id);
    
    PRINT 'Foreign key constraint FK_domains_user_id added to domains table.';
END
ELSE
BEGIN
    PRINT 'Foreign key constraint FK_domains_user_id already exists.';
END
GO