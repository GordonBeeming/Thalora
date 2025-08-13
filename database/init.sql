-- Thalora Database Initialization Script
-- Create database if it doesn't exist
IF NOT EXISTS (SELECT *
FROM sys.databases
WHERE name = 'ThaloraDB')
BEGIN
    CREATE DATABASE ThaloraDB;
END
GO

USE ThaloraDB;
GO

-- Create urls table for storing original and shortened URLs
IF NOT EXISTS (SELECT *
FROM sys.tables
WHERE name = 'urls')
BEGIN
    CREATE TABLE urls
    (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        original_url NVARCHAR(2048) NOT NULL,
        shortened_url NVARCHAR(255) NOT NULL UNIQUE,
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        updated_at DATETIME2 DEFAULT GETUTCDATE()
    );

    -- Index for faster lookups by shortened_url
    CREATE INDEX IX_urls_shortened_url ON urls(shortened_url);

    -- Index for created_at for potential analytics
    CREATE INDEX IX_urls_created_at ON urls(created_at);
END
GO

-- Sample data for testing (optional - can be removed in production)
-- INSERT INTO urls (original_url, shortened_url) VALUES 
--     ('https://www.example.com', 'abcd1234'),
--     ('https://www.gordonbeeming.com', 'efgh5678');
-- GO

PRINT 'ThaloraDB database and urls table created successfully.';
GO