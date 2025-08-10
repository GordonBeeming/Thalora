# Thalora Development Instructions

Thalora is a modern, secure, and customizable URL shortener built with React (frontend), Rust (backend), SQL Server (database), and Docker (containerization). It features passkey-based authentication for secure and simple login.

**ALWAYS reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Current Project State

**CRITICAL**: This repository currently contains only project specifications in README.md. The actual implementation (React frontend, Rust backend, Docker configuration) has not been developed yet. Most build and run commands described below cannot be executed until the implementation is complete.

## Core Principles

**CRITICAL RULES**: The following principles must be followed for all development decisions:

### Configuration Management
- **Never use fallbacks in configuration**: If config values cannot be extracted (e.g., database name from connection string), throw an error immediately. Config should be correct or fail fast.
- **No hardcoded values in production code**: All configuration values must come from environment variables or config files.
- **Explicit configuration failures**: When config extraction fails, provide clear error messages explaining exactly what is missing.

### Database and Schema Management
- **Never create schema in application code**: Production applications should only have read/write access to the database schema, not create it.
- **Migrations are separate from application**: All database schema changes must be in migration scripts, never in the application code.
- **Database-first deployments**: Migrations run before application deployment, not during application startup.
- **No USE statements when database is in connection string**: If the connection string specifies a database, SQL queries should not include `USE [database]` statements.

### Feedback Integration
- **Update instructions for coding patterns**: When specific feedback is given about "doing something a certain way", immediately update these instructions to include that pattern as a core principle.
- **Document architectural decisions**: All feedback about production practices should be captured in these instructions to prevent future violations.

**ALWAYS reference these principles first when making any coding decisions.**

## Working Effectively

### Prerequisites Setup
Before beginning development, ensure the following tools are installed:

- **Docker & Docker Compose**: Required for containerization and database management
  - Install Docker: `curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh`
  - Install Docker Compose: `sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose`

- **Rust Development Environment**: Required for backend development
  - Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
  - Source the environment: `source ~/.cargo/env`
  - Install additional components: `rustup component add clippy rustfmt`

- **Node.js & pnpm**: Required for React frontend development
  - Install Node.js LTS: `curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs`
  - Install pnpm: `npm install -g pnpm`
  - Verify installation: `node --version && pnpm --version`

### Initial Repository Setup
When the implementation is added, follow these steps:

1. **Clone and enter the repository**:
   ```bash
   git clone https://github.com/GordonBeeming/Thalora.git
   cd Thalora
   ```

2. **Install dependencies** (when package.json exists):
   ```bash
   pnpm install
   ```
   - **TIMING**: Frontend dependency installation typically takes 2-5 minutes
   - **NEVER CANCEL**: Set timeout to 15+ minutes to account for network variations and pnpm's package resolution

3. **Backend setup** (when Cargo.toml exists):
   ```bash
   cd backend
   cargo build
   ```
   - **TIMING**: Initial Rust compilation takes 10-20 minutes for complex projects
   - **NEVER CANCEL**: Set timeout to 30+ minutes for initial builds
   - **NEVER CANCEL**: Subsequent builds are faster (1-3 minutes)

### Building the Application

#### Frontend Build (when implemented):
```bash
cd frontend
pnpm run build
```
- **TIMING**: React production builds typically take 2-5 minutes
- **NEVER CANCEL**: Set timeout to 10+ minutes for complex applications

#### Backend Build (when implemented):
```bash
cd backend
cargo build --release
```
- **TIMING**: Release builds take 15-25 minutes due to optimizations
- **NEVER CANCEL**: Set timeout to 45+ minutes for release builds
- **NEVER CANCEL**: Debug builds (`cargo build`) are faster but still allow 15+ minutes

### Running the Application

#### Development Mode (when implemented):
1. **Start the database**:
   ```bash
   docker-compose up -d sqlserver
   ```
   - **TIMING**: Database container startup takes 30-60 seconds
   - Wait for "SQL Server is now ready for client connections" in logs

2. **Start the backend**:
   ```bash
   cd backend
   cargo run
   ```
   - **TIMING**: Development server starts in 30-60 seconds after compilation
   - Backend typically runs on `http://localhost:8080`

3. **Start the frontend**:
   ```bash
   cd frontend
   pnpm run dev
   ```
   - **TIMING**: Vite/React dev server starts in 10-30 seconds
   - Frontend typically runs on `http://localhost:3000`

#### Production Mode (when implemented):
```bash
docker-compose up -d
```
- **TIMING**: Full stack startup takes 2-3 minutes
- **NEVER CANCEL**: Set timeout to 5+ minutes for complete initialization

### Testing

#### Frontend Tests (when implemented):
```bash
cd frontend
pnpm test
```
- **TIMING**: React test suites typically take 1-3 minutes
- **NEVER CANCEL**: Set timeout to 10+ minutes for comprehensive test suites

#### Backend Tests (when implemented):
```bash
cd backend
cargo test
```
- **TIMING**: Rust test suites take 2-5 minutes including compilation
- **NEVER CANCEL**: Set timeout to 15+ minutes for extensive test coverage

#### Integration Tests (when implemented):
```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```
- **TIMING**: Full integration tests take 5-10 minutes
- **NEVER CANCEL**: Set timeout to 20+ minutes for comprehensive integration testing

### Code Quality and Validation

#### Always run these before committing:

1. **Rust formatting and linting**:
   ```bash
   cd backend
   cargo fmt --check
   cargo clippy -- -D warnings
   ```

2. **Frontend formatting and linting**:
   ```bash
   cd frontend
   pnpm run lint
   pnpm run format:check
   ```

3. **Type checking**:
   ```bash
   cd frontend
   pnpm run type-check
   ```

#### Manual Validation Requirements

**CRITICAL**: After making any changes, always validate the complete user workflow:

1. **URL Shortening Flow**:
   - Navigate to the frontend application
   - Register/login using passkey authentication
   - Create a shortened URL
   - Test the shortened URL redirection
   - Verify custom domain functionality (if configured)

2. **Authentication Flow**:
   - Test passkey registration
   - Test passkey login
   - Verify secure session management
   - Test logout functionality

3. **Database Operations**:
   - Verify URL storage and retrieval
   - Test user data persistence
   - Confirm analytics tracking (if implemented)

## Project Structure

### Expected Directory Layout (when implemented):
```
.
├── README.md
├── docker-compose.yml
├── docker-compose.test.yml
├── frontend/
│   ├── package.json
│   ├── src/
│   ├── public/
│   └── Dockerfile
├── backend/
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs
│   │   ├── auth/          # Passkey authentication logic
│   │   ├── handlers/      # HTTP request handlers
│   │   └── models/        # Data models
│   └── Dockerfile
├── database/
│   ├── migrations/        # SQL Server migration scripts
│   └── init.sql
└── .github/
    ├── workflows/         # CI/CD pipelines
    └── copilot-instructions.md
```

### Key Components:

- **Frontend (`frontend/`)**: React application with TypeScript
  - **Authentication**: WebAuthn/FIDO2 passkey implementation
  - **UI Components**: URL input, dashboard, analytics views
  - **API Integration**: REST client for backend communication

- **Backend (`backend/`)**: Rust web server (Actix-Web or Warp)
  - **Authentication Module (`auth/`)**: Passkey verification and session management
  - **URL Handler (`handlers/url.rs`)**: URL shortening and redirection logic
  - **Database Layer (`models/`)**: SQL Server integration with entity models

- **Database (`database/`)**: SQL Server setup and migrations
  - **Tables**: Users, URLs, Analytics, Sessions
  - **Indexes**: Optimized for URL lookup performance

## Common Development Tasks

### Adding New URL Shortening Features:
1. Update database schema in `database/migrations/`
2. Modify Rust models in `backend/src/models/`
3. Update API handlers in `backend/src/handlers/`
4. Add frontend components in `frontend/src/components/`
5. Always test the complete flow: create → store → retrieve → redirect

### Modifying Authentication:
1. Review WebAuthn specifications before changes
2. Update `backend/src/auth/` modules
3. Modify frontend authentication components
4. **CRITICAL**: Always test passkey registration AND login flows
5. Verify cross-browser compatibility

### Database Changes:
1. Create migration in `database/migrations/`
2. Update Rust models to match schema
3. Run migration: `sqlcmd -S localhost -U sa -P yourpassword -i migration.sql`
4. Test with sample data to ensure compatibility

### Performance Optimization:
1. Monitor database query performance with SQL Server profiler
2. Optimize Rust code with `cargo bench` (when benchmarks exist)
3. Analyze frontend bundle size with `pnpm run analyze`
4. Always measure before and after optimization changes

## CI/CD Integration

### GitHub Actions (when `.github/workflows/` exists):
The repository includes automated workflows for:
- **Build verification**: Runs on every PR
- **Test execution**: Unit and integration tests
- **Security scanning**: Rust and pnpm dependency audits
- **Container building**: Docker image creation

**TIMING EXPECTATIONS**:
- **Full CI pipeline**: 15-25 minutes
- **NEVER CANCEL**: CI builds may take up to 45 minutes under heavy load
- **Build + Test workflow**: Allow 30+ minutes timeout

### Pre-commit Requirements:
Always run before pushing:
```bash
# Format and lint all code
cd backend && cargo fmt && cargo clippy
cd ../frontend && pnpm run lint && pnpm run format

# Run tests
cd backend && cargo test
cd ../frontend && pnpm test

# Build verification
docker-compose build
```

## Troubleshooting

### Common Issues:

1. **SQL Server connection errors**:
   - Verify Docker container is running: `docker ps`
   - Check connection string in backend configuration
   - Ensure TCP/IP is enabled on SQL Server instance

2. **Passkey authentication failures**:
   - Verify HTTPS is enabled (required for WebAuthn)
   - Check browser developer tools for WebAuthn errors
   - Confirm origin matches registered domain

3. **Rust compilation errors**:
   - Update toolchain: `rustup update`
   - Clear target directory: `cargo clean`
   - Check Cargo.lock for dependency conflicts

4. **Frontend build failures**:
   - Clear node_modules: `rm -rf node_modules && pnpm install`
   - Check Node.js version compatibility
   - Verify TypeScript configuration

### Performance Monitoring:
- **Backend**: Monitor Rust application metrics and SQL Server performance
- **Frontend**: Use browser DevTools to analyze load times and bundle sizes
- **Database**: Review query execution plans and index usage

## Security Considerations

### Development Security:
- **Never commit secrets**: Use environment variables for configuration
- **HTTPS required**: Passkey authentication requires secure context
- **Database security**: Use strong passwords and network isolation
- **Dependencies**: Regularly audit with `cargo audit` and `pnpm audit`

### Production Deployment:
- **Container security**: Scan images with vulnerability tools
- **Database encryption**: Enable TDE (Transparent Data Encryption)
- **Network security**: Use proper firewall rules and VPC configuration
- **Monitoring**: Implement logging and alerting for security events

---

**Remember**: This repository is currently in the specification phase. Most commands above will only work once the actual implementation is added. Always verify the existence of configuration files (package.json, Cargo.toml, docker-compose.yml) before attempting to execute build or run commands.