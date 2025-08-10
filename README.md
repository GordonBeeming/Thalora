# Thalora

**Thalora** is a modern, secure, and customizable URL shortener designed for simplicity and performance. It allows users to shorten URLs and configure their own custom domains for links. Built with **React**, **Rust**, and **SQL Server**, Thalora focuses on providing an efficient, user-friendly experience with security features like **passkey-based authentication**.

## Features

- **Custom domain support**: Users can configure their own domains for shortened URLs.
- **Passwordless authentication**: Uses **passkeys** for secure and simple login.
- **Responsive UI**: Optimized for both desktop and mobile with a clean, modern design.
- **Fast and secure backend**: Powered by **Rust** for performance and scalability.
- **Simple error handling**: User-friendly design that displays helpful error messages.

## Tech Stack

- **Frontend**: React
- **Backend**: Rust (using Actix or Warp)
- **Database**: SQL Server
- **Authentication**: Passkey-based authentication (WebAuthn/FIDO2)
- **Containerization**: Docker

## Installation

### Prerequisites
- **Docker** and **Docker Compose** for containerization.
- **Rust** for backend development (if modifying backend code).
- **Node.js** and **pnpm** for frontend development (if modifying frontend code).

### Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/gordonbeeming/thalora.git
   cd thalora
   ```

## Running the Applications

### Prerequisites
- **Docker** and **Docker Compose** for running SQL Server
- **Rust** for backend development
- **Node.js** and **pnpm** for frontend development

### Database Setup

The application uses **SQL Server** for persistent URL storage. To set up the database:

1. **Quick Setup (Recommended)**:
   ```bash
   ./scripts/setup-dev-db.sh
   ```

2. **Manual Setup**:
   ```bash
   # Start SQL Server container
   docker compose up -d sqlserver
   
   # Wait for SQL Server to start (about 20 seconds)
   
   # Create database and tables
   docker exec thalora-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P TaloraDevPassword123! -C -Q "CREATE DATABASE TaloraDB;"
   docker exec thalora-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P TaloraDevPassword123! -d TaloraDB -C -i /home/database/init.sql
   ```

### Backend (Rust API)

1. **Make sure the database is running** (see Database Setup above)

2. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install Rust dependencies and run the backend:
   ```bash
   cargo run
   ```
   
   The backend will start on `http://localhost:8080`

3. To run in release mode (optimized):
   ```bash
   cargo run --release
   ```

4. To run the tests:
   ```bash
   cargo test
   ```

### Frontend (React)

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd thalora-frontend
   ```

2. Install Node.js dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm start
   ```
   
   The frontend will start on `http://localhost:3000` and automatically open in your browser.

4. To run the tests:
   ```bash
   pnpm test
   ```

5. To build for production:
   ```bash
   pnpm run build
   ```

### Running Both Applications Together

To run the complete Thalora application:

1. **Setup the database**:
   ```bash
   ./scripts/setup-dev-db.sh
   ```

2. **Terminal 2 - Start the backend:**
   ```bash
   cd backend
   cargo run
   ```
   
3. **Terminal 3 - Start the frontend:**
   ```bash
   cd thalora-frontend
   pnpm install  # Only needed the first time
   pnpm start
   ```

4. **Access the application:**
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:8080`
   - API Health Check: `http://localhost:8080/health`

The frontend will automatically communicate with the backend API running on port 8080. Make sure both the database and backend servers are running for full functionality.

### Configuration

The application uses environment variables for configuration. Copy `.env.example` to `.env` and modify as needed:

```bash
cp .env.example .env
```

**Important configuration variables:**
- `DATABASE_URL`: SQL Server connection string
- `SERVER_HOST`: Backend server host (default: 127.0.0.1)  
- `SERVER_PORT`: Backend server port (default: 8080)
- `RUST_LOG`: Logging level (default: info)

### API Endpoints

The backend provides the following endpoints:

- `GET /health` - Health check endpoint
- `POST /shorten` - Create a shortened URL (HTTPS URLs only)
- `GET /shortened-url/{id}` - Redirect to the original URL

### Example Usage

Once both applications are running, you can:

1. Open `http://localhost:3000` in your browser
2. Enter an HTTPS URL (e.g., `https://www.example.com`) 
3. Click "Shorten URL" to generate a shortened link
4. Use the shortened link to redirect to the original URL

> **Note**: Only HTTPS URLs are supported for security reasons. HTTP URLs will be rejected with an error message.
