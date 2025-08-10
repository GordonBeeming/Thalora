-- Migration 002: Create urls table for URL shortening functionality
-- Created: 2025-01-XX
-- Description: Creates the main urls table for storing shortened URLs

-- Create urls table for storing URL mappings
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'urls')
BEGIN
    CREATE TABLE urls (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        original_url NVARCHAR(2048) NOT NULL,
        shortened_url NVARCHAR(255) NOT NULL UNIQUE,
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        updated_at DATETIME2 DEFAULT GETUTCDATE()
    );
    
    -- Index for fast lookups by shortened URL (most common operation)
    CREATE INDEX IX_urls_shortened_url ON urls(shortened_url);
    
    -- Index for created_at for analytics and sorting
    CREATE INDEX IX_urls_created_at ON urls(created_at);
    
    PRINT 'URLs table and indexes created successfully.';
END
ELSE
BEGIN
    PRINT 'URLs table already exists.';
END
GO