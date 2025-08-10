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

# Wait for SQL Server to be healthy
echo "Waiting for SQL Server to be ready..."
echo "This may take up to 60 seconds for the first time..."

# Wait for the container to be healthy (up to 2 minutes)
timeout=120
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker compose ps sqlserver | grep -q "healthy"; then
        echo "✅ SQL Server is ready!"
        break
    fi
    sleep 5
    elapsed=$((elapsed + 5))
    echo "Still waiting... (${elapsed}s)"
done

if [ $elapsed -ge $timeout ]; then
    echo "❌ SQL Server failed to start within ${timeout} seconds"
    echo "Check the logs with: docker compose logs sqlserver"
    exit 1
fi

echo ""
echo "🎉 Database setup complete!"
echo ""
echo "🚀 Running database migrations..."

# Get the directory of this script
SCRIPT_DIR="$(dirname "$0")"

# Run migrations
if "$SCRIPT_DIR/run-migrations.sh"; then
    echo ""
    echo "✅ Migrations completed successfully!"
else
    echo ""
    echo "❌ Migration failed! Please check the logs above."
    exit 1
fi

echo ""
echo "The backend will now connect to the properly configured database."
echo ""
echo "To start the backend:"
echo "  cd backend && cargo run"
echo ""
echo "Test the API:"
echo '  curl -X POST http://localhost:8080/shorten -H "Content-Type: application/json" -d '"'"'{"url": "https://www.example.com"}'"'"''
echo "  curl http://localhost:8080/health"