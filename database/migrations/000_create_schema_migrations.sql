-- Migration 000: Create schema migrations tracking table
-- Created: 2025-01-XX
-- Description: Creates the schema_migrations table to track applied migrations

-- Create schema_migrations table for tracking applied migrations
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'schema_migrations')
BEGIN
    CREATE TABLE schema_migrations (
        migration_hash NVARCHAR(64) PRIMARY KEY,
        migration_filename NVARCHAR(255) NOT NULL,
        applied_at DATETIME2 DEFAULT GETUTCDATE()
    );
    
    -- Index for filename lookups
    CREATE INDEX IX_schema_migrations_filename ON schema_migrations(migration_filename);
    
    PRINT 'Schema migrations table created successfully.';
END
ELSE
BEGIN
    PRINT 'Schema migrations table already exists.';
END
GO