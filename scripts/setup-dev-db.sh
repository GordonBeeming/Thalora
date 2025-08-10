#!/bin/bash
# Database setup script for development
set -e

echo "Setting up Thalora development database..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Start SQL Server container
echo "Starting SQL Server container..."
docker compose up -d sqlserver

# Wait for SQL Server to be ready
echo "Waiting for SQL Server to start..."
sleep 20

# Create database and tables
echo "Creating TaloraDB database..."
docker exec thalora-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P TaloraDevPassword123! -C -Q "
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'TaloraDB')
BEGIN
    CREATE DATABASE TaloraDB;
END
"

echo "Creating database tables..."
docker exec thalora-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P TaloraDevPassword123! -d TaloraDB -C -Q "
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'urls')
BEGIN
    CREATE TABLE urls (
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
    
    PRINT 'TaloraDB database and urls table created successfully.';
END
ELSE
BEGIN
    PRINT 'urls table already exists.';
END
"

echo ""
echo "Database setup complete!"
echo "You can now start the backend with: cd backend && cargo run"
echo ""
echo "Test the API:"
echo '  curl -X POST http://localhost:8080/shorten -H "Content-Type: application/json" -d '"'"'{"url": "https://www.example.com"}'"'"''
echo "  curl http://localhost:8080/health"