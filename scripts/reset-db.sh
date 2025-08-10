#!/bin/bash
# Database reset script for Thalora - removes volume and runs setup again
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_status $BLUE "🔄 Resetting Thalora development database..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_status $RED "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Stop and remove containers
print_status $YELLOW "🛑 Stopping containers..."
docker compose down

# Remove database volume
print_status $YELLOW "🗑️  Removing database volume..."
if docker volume ls | grep -q "thalora.*sqlserver"; then
    docker volume rm $(docker volume ls -q | grep "thalora.*sqlserver") 2>/dev/null || true
    print_status $GREEN "✅ Database volume removed"
else
    print_status $YELLOW "ℹ️  No database volume found to remove"
fi

# Clean up any orphaned volumes
print_status $YELLOW "🧹 Cleaning up orphaned volumes..."
docker volume prune -f

print_status $GREEN ""
print_status $GREEN "🎉 Database reset complete!"
print_status $GREEN ""
print_status $BLUE "🚀 Running setup script..."

# Run the setup script
SCRIPT_DIR="$(dirname "$0")"
exec "$SCRIPT_DIR/setup-dev-db.sh"