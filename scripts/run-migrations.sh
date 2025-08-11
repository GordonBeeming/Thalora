#!/bin/bash
# Database migration runner for Thalora
set -e

# Configuration
MIGRATIONS_DIR="$(dirname "$0")/../database/migrations"
SCRIPT_DIR="$(dirname "$0")"

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

# Function to calculate SHA256 hash of a file
calculate_hash() {
    local file="$1"
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$file" | cut -d' ' -f1
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$file" | cut -d' ' -f1
    else
        print_status $RED "Error: Neither sha256sum nor shasum is available for calculating file hashes"
        exit 1
    fi
}

# Function to get database name from connection string
get_database_name() {
    if [[ -f "$SCRIPT_DIR/../backend/.env" ]]; then
        local connection_string=$(grep "^DATABASE_URL=" "$SCRIPT_DIR/../backend/.env" | cut -d'=' -f2-)
        if [[ $connection_string =~ Database=([^;]+) ]]; then
            echo "${BASH_REMATCH[1]}"
        else
            print_status $RED "Error: No Database parameter found in DATABASE_URL. Connection string must include Database=<database_name>"
            exit 1
        fi
    elif [[ -f "$SCRIPT_DIR/../.env" ]]; then
        local connection_string=$(grep "^DATABASE_URL=" "$SCRIPT_DIR/../.env" | cut -d'=' -f2-)
        if [[ $connection_string =~ Database=([^;]+) ]]; then
            echo "${BASH_REMATCH[1]}"
        else
            print_status $RED "Error: No Database parameter found in DATABASE_URL. Connection string must include Database=<database_name>"
            exit 1
        fi
    else
        print_status $RED "Error: No .env file found. Please create .env file with DATABASE_URL"
        exit 1
    fi
}

# Function to create database if it doesn't exist
create_database_if_not_exists() {
    local database="$1"
    local password="$2"
    
    print_status $BLUE "🗃️  Ensuring database '$database' exists..."
    
    local create_db_sql="
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '$database')
BEGIN
    CREATE DATABASE [$database];
    PRINT 'Database $database created successfully.';
END
ELSE
BEGIN
    PRINT 'Database $database already exists.';
END
"
    
    # Execute against master database to create the target database
    if command -v sqlcmd >/dev/null 2>&1; then
        echo "$create_db_sql" | sqlcmd -S localhost,1433 -U sa -P "$password" -d master -b
    else
        echo "$create_db_sql" | docker exec -i $(docker compose ps -q sqlserver) /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$password" -d master -C
    fi
}

# Function to execute SQL script
execute_sql() {
    local file="$1"
    local database="$2"
    
    print_status $BLUE "📄 Executing: $(basename "$file")"
    
    # Read password from .env file
    local password=""
    if [[ -f "$SCRIPT_DIR/../backend/.env" ]]; then
        local connection_string=$(grep "^DATABASE_URL=" "$SCRIPT_DIR/../backend/.env" | cut -d'=' -f2-)
        if [[ $connection_string =~ Password=([^;]+) ]]; then
            password="${BASH_REMATCH[1]}"
        fi
    elif [[ -f "$SCRIPT_DIR/../.env" ]]; then
        local connection_string=$(grep "^DATABASE_URL=" "$SCRIPT_DIR/../.env" | cut -d'=' -f2-)
        if [[ $connection_string =~ Password=([^;]+) ]]; then
            password="${BASH_REMATCH[1]}"
        fi
    fi
    
    if [[ -z "$password" ]]; then
        print_status $RED "Error: Could not extract password from DATABASE_URL in .env file"
        exit 1
    fi
    
    # Execute the SQL script
    if command -v sqlcmd >/dev/null 2>&1; then
        sqlcmd -S localhost,1433 -U sa -P "$password" -d "$database" -i "$file" -b
    else
        print_status $YELLOW "Warning: sqlcmd not available, using docker exec"
        docker exec -i $(docker compose ps -q sqlserver) /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$password" -d "$database" -C -i /dev/stdin < "$file"
    fi
}

# Function to check if migration was already applied
is_migration_applied() {
    local hash="$1"
    local database="$2"
    
    # Read password from .env file
    local password=""
    if [[ -f "$SCRIPT_DIR/../backend/.env" ]]; then
        local connection_string=$(grep "^DATABASE_URL=" "$SCRIPT_DIR/../backend/.env" | cut -d'=' -f2-)
        if [[ $connection_string =~ Password=([^;]+) ]]; then
            password="${BASH_REMATCH[1]}"
        fi
    elif [[ -f "$SCRIPT_DIR/../.env" ]]; then
        local connection_string=$(grep "^DATABASE_URL=" "$SCRIPT_DIR/../.env" | cut -d'=' -f2-)
        if [[ $connection_string =~ Password=([^;]+) ]]; then
            password="${BASH_REMATCH[1]}"
        fi
    fi
    
    if [[ -z "$password" ]]; then
        print_status $RED "Error: Could not extract password from DATABASE_URL in .env file"
        exit 1
    fi
    
    # Check if the hash exists in schema_migrations table
    local query="SELECT COUNT(*) FROM schema_migrations WHERE migration_hash = '$hash'"
    local result
    
    if command -v sqlcmd >/dev/null 2>&1; then
        result=$(sqlcmd -S localhost,1433 -U sa -P "$password" -d "$database" -Q "$query" -h -1 -W 2>/dev/null | tr -d ' \n\r')
    else
        result=$(docker exec -i $(docker compose ps -q sqlserver) /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$password" -d "$database" -C -Q "$query" -h -1 -W 2>/dev/null | tr -d ' \n\r')
    fi
    
    [[ "$result" == "1" ]]
}

# Function to record migration as applied
record_migration() {
    local hash="$1"
    local filename="$2"
    local database="$3"
    
    # Read password from .env file
    local password=""
    if [[ -f "$SCRIPT_DIR/../backend/.env" ]]; then
        local connection_string=$(grep "^DATABASE_URL=" "$SCRIPT_DIR/../backend/.env" | cut -d'=' -f2-)
        if [[ $connection_string =~ Password=([^;]+) ]]; then
            password="${BASH_REMATCH[1]}"
        fi
    elif [[ -f "$SCRIPT_DIR/../.env" ]]; then
        local connection_string=$(grep "^DATABASE_URL=" "$SCRIPT_DIR/../.env" | cut -d'=' -f2-)
        if [[ $connection_string =~ Password=([^;]+) ]]; then
            password="${BASH_REMATCH[1]}"
        fi
    fi
    
    if [[ -z "$password" ]]; then
        print_status $RED "Error: Could not extract password from DATABASE_URL in .env file"
        exit 1
    fi
    
    local query="INSERT INTO schema_migrations (migration_hash, migration_filename) VALUES ('$hash', '$filename')"
    
    if command -v sqlcmd >/dev/null 2>&1; then
        sqlcmd -S localhost,1433 -U sa -P "$password" -d "$database" -Q "$query"
    else
        docker exec -i $(docker compose ps -q sqlserver) /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$password" -d "$database" -C -Q "$query"
    fi
}

# Main execution
main() {
    print_status $BLUE "🚀 Starting Thalora database migrations..."
    
    # Get database name
    local database_name=$(get_database_name)
    print_status $BLUE "📊 Target database: $database_name"
    
    # Read password for database creation
    local password=""
    if [[ -f "$SCRIPT_DIR/../backend/.env" ]]; then
        local connection_string=$(grep "^DATABASE_URL=" "$SCRIPT_DIR/../backend/.env" | cut -d'=' -f2-)
        if [[ $connection_string =~ Password=([^;]+) ]]; then
            password="${BASH_REMATCH[1]}"
        fi
    elif [[ -f "$SCRIPT_DIR/../.env" ]]; then
        local connection_string=$(grep "^DATABASE_URL=" "$SCRIPT_DIR/../.env" | cut -d'=' -f2-)
        if [[ $connection_string =~ Password=([^;]+) ]]; then
            password="${BASH_REMATCH[1]}"
        fi
    fi
    
    if [[ -z "$password" ]]; then
        print_status $RED "Error: Could not extract password from DATABASE_URL in .env file"
        exit 1
    fi
    
    # Create database if it doesn't exist
    create_database_if_not_exists "$database_name" "$password"
    
    # Check if migrations directory exists
    if [[ ! -d "$MIGRATIONS_DIR" ]]; then
        print_status $RED "Error: Migrations directory not found: $MIGRATIONS_DIR"
        exit 1
    fi
    
    # Process migrations in order
    local migration_count=0
    local applied_count=0
    local skipped_count=0
    
    for migration_file in "$MIGRATIONS_DIR"/*.sql; do
        if [[ -f "$migration_file" ]]; then
            local filename=$(basename "$migration_file")
            local hash=$(calculate_hash "$migration_file")
            
            migration_count=$((migration_count + 1))
            
            print_status $YELLOW "🔍 Processing migration: $filename (hash: ${hash:0:12}...)"
            
            # Check if migration was already applied
            if is_migration_applied "$hash" "$database_name"; then
                print_status $GREEN "✅ Already applied: $filename"
                skipped_count=$((skipped_count + 1))
            else
                print_status $YELLOW "▶️  Applying migration: $filename"
                
                # Execute the migration
                if execute_sql "$migration_file" "$database_name"; then
                    # Record successful migration (only if not already recorded)
                    if ! is_migration_applied "$hash" "$database_name"; then
                        record_migration "$hash" "$filename" "$database_name"
                    fi
                    print_status $GREEN "✅ Successfully applied: $filename"
                    applied_count=$((applied_count + 1))
                else
                    print_status $RED "❌ Failed to apply migration: $filename"
                    exit 1
                fi
            fi
        fi
    done
    
    print_status $GREEN ""
    print_status $GREEN "🎉 Migration summary:"
    print_status $GREEN "   📊 Total migrations: $migration_count"
    print_status $GREEN "   ✅ Applied: $applied_count"
    print_status $GREEN "   ⏭️  Skipped: $skipped_count"
    print_status $GREEN ""
    print_status $GREEN "✨ All migrations completed successfully!"
}

# Run main function
main "$@"