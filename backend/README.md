# Thalora Backend

A Rust-based URL shortener backend with SQL Server database integration.

## Quick Start

### Prerequisites

1. **Rust** (latest stable)
2. **SQL Server** (2022 or later)
   - **Option A**: Use Docker (recommended for development)
   - **Option B**: Install SQL Server locally

### Setup

#### Option A: Using Docker (Recommended)

1. **Start SQL Server container:**
   ```bash
   # From the repository root
   ./scripts/setup-dev-db.sh
   ```
   This will:
   - Start SQL Server 2022 in a Docker container
   - Create the `TaloraDB` database
   - Create the `urls` table with proper indexes

2. **Copy environment configuration:**
   ```bash
   # The .env file is already created for local development
   # It uses the Docker SQL Server configuration
   cat .env
   ```

3. **Run the backend:**
   ```bash
   cd backend
   cargo run
   ```

#### Option B: Using Local SQL Server

1. **Install SQL Server** on your system

2. **Create a `.env` file** in the project root:
   ```env
   DATABASE_URL=Server=localhost,1433;Database=master;User=sa;Password=YourPassword;TrustServerCertificate=true;
   SERVER_HOST=127.0.0.1
   SERVER_PORT=8080
   RUST_LOG=info
   ```

3. **Run the backend:**
   ```bash
   cd backend
   cargo run
   ```
   The backend will automatically create the database and tables if they don't exist.

## Database Schema

The backend automatically creates the following schema:

- **Database**: `TaloraDB`
- **Table**: `urls`
  - `id` (BIGINT, auto-increment primary key)
  - `original_url` (NVARCHAR(2048))
  - `shortened_url` (NVARCHAR(255), unique)
  - `created_at` (DATETIME2, UTC default)
  - `updated_at` (DATETIME2, UTC default)

## API Endpoints

- **POST** `/shorten` - Create a shortened URL
- **GET** `/shortened-url/{id}` - Redirect to original URL
- **GET** `/health` - Health check

## Testing

```bash
# Run tests
cargo test

# Test the API (after starting the backend)
curl -X POST http://localhost:8080/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.example.com"}'

curl http://localhost:8080/health
```

## Troubleshooting

### Backend hangs during startup

**Symptoms:** Backend logs show "Performing a TLS handshake" but never shows "Server will bind to..."

**Solutions:**
1. **Check if SQL Server is running:**
   ```bash
   docker ps | grep thalora-sqlserver
   # or for local SQL Server:
   # Check if SQL Server service is running
   ```

2. **Verify database connection:**
   ```bash
   # Test Docker SQL Server connection
   docker exec thalora-sqlserver /opt/mssql-tools18/bin/sqlcmd \
     -S localhost -U sa -P TaloraDevPassword123! -C -Q "SELECT 1"
   ```

3. **Check .env configuration:**
   - Ensure `DATABASE_URL` is correctly set
   - For Docker setup, use `TrustServerCertificate=true`
   - Connect to `master` database initially (backend will create TaloraDB)

### Database connection errors

1. **"Failed to connect to database":**
   - Ensure SQL Server is running and accessible
   - Check firewall settings
   - Verify connection string format

2. **"Failed to initialize database":**
   - Ensure the SQL Server user has sufficient privileges to create databases
   - For Docker setup, the default `sa` user should work
   - Check SQL Server error logs

### Performance Issues

- Check SQL Server performance counters
- Monitor connection pool usage
- Review query execution plans

## Environment Variables

- `DATABASE_URL` - SQL Server connection string (required)
- `SERVER_HOST` - Server bind address (default: 127.0.0.1)
- `SERVER_PORT` - Server port (default: 8080)
- `RUST_LOG` - Logging level (default: info)