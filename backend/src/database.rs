use anyhow::Result;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::env;
use tiberius::Config;
use bb8::Pool;
use bb8_tiberius::ConnectionManager;

pub type DatabasePool = Pool<ConnectionManager>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UrlEntry {
    pub id: i64,
    pub original_url: String,
    pub shortened_url: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    pub connection_string: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub encryption_enabled: bool,
}

impl DatabaseConfig {
    pub fn from_env() -> Result<Self> {
        let base_connection_string = env::var("DATABASE_URL")
            .map_err(|_| anyhow::anyhow!("DATABASE_URL environment variable not set"))?;
        
        // Parse environment variables for pool configuration
        let max_connections = env::var("DB_MAX_CONNECTIONS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(10);
            
        let min_connections = env::var("DB_MIN_CONNECTIONS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(1);

        // Determine if we should enable encryption based on environment
        let encryption_enabled = env::var("DB_ENCRYPTION_ENABLED")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or_else(|| {
                // Default: disable encryption for local development, enable for production
                let is_production = env::var("ENVIRONMENT")
                    .unwrap_or_else(|_| "development".to_string())
                    .to_lowercase() == "production";
                is_production
            });

        // Build connection string with appropriate encryption settings
        let connection_string = if encryption_enabled {
            // Production: use encryption with certificate trust
            if !base_connection_string.contains("Encrypt=") {
                format!("{};Encrypt=yes;TrustServerCertificate=true", base_connection_string)
            } else {
                base_connection_string
            }
        } else {
            // Development: disable encryption for compatibility with SQL Server 2022 in Docker
            if base_connection_string.contains("Encrypt=") {
                // Replace any existing Encrypt setting
                let re = regex::Regex::new(r"Encrypt=[^;]*;?").unwrap();
                let updated = re.replace_all(&base_connection_string, "");
                format!("{};Encrypt=no;TrustServerCertificate=yes", updated.trim_end_matches(';'))
            } else {
                format!("{};Encrypt=no;TrustServerCertificate=yes", base_connection_string)
            }
        };

        info!("Database encryption enabled: {}", encryption_enabled);
        if !encryption_enabled {
            warn!("Database encryption is DISABLED. This should only be used for local development.");
        }
        
        Ok(DatabaseConfig {
            connection_string,
            max_connections,
            min_connections,
            encryption_enabled,
        })
    }
}

pub async fn create_connection_pool(config: &DatabaseConfig) -> Result<DatabasePool> {
    info!("Creating database connection pool with {}-{} connections...", config.min_connections, config.max_connections);
    
    // Parse connection string for Tiberius
    let tiberius_config = Config::from_ado_string(&config.connection_string)
        .map_err(|e| anyhow::anyhow!("Invalid DATABASE_URL format: {}", e))?;
    
    // Create connection manager
    let connection_manager = ConnectionManager::new(tiberius_config);
    
    // Build the connection pool
    let pool = Pool::builder()
        .max_size(config.max_connections)
        .min_idle(Some(config.min_connections))
        .build(connection_manager)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to create connection pool: {}", e))?;

    info!("Database connection pool created successfully");
    
    // Test the pool with a simple query
    info!("Testing connection pool...");
    {
        let mut conn = pool.get().await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;
        
        let query = tiberius::Query::new("SELECT 1 as test");
        let stream = query.query(&mut *conn).await
            .map_err(|e| anyhow::anyhow!("Database connection test failed: {}", e))?;
        
        let _rows = stream.into_first_result().await?;
        info!("Connection pool test successful");
    } // conn is dropped here
    
    Ok(pool)
}

pub struct DatabaseService;

impl DatabaseService {
    pub async fn initialize_database(pool: &DatabasePool) -> Result<()> {
        info!("Initializing database schema...");
        
        let mut conn = pool.get().await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;
        
        // Check if TaloraDB database exists, create if not
        let db_check_query = "
            SELECT COUNT(*) as db_exists 
            FROM sys.databases 
            WHERE name = 'TaloraDB'
        ";
        
        let query = tiberius::Query::new(db_check_query);
        let stream = query.query(&mut *conn).await?;
        let row = stream.into_first_result().await?;
        
        let db_exists = if let Some(row) = row.into_iter().next() {
            let count: i32 = row.get(0).unwrap_or(0);
            count > 0
        } else {
            false
        };
        
        if !db_exists {
            info!("Creating TaloraDB database...");
            let create_db_query = "CREATE DATABASE TaloraDB";
            let query = tiberius::Query::new(create_db_query);
            query.execute(&mut *conn).await?;
            info!("TaloraDB database created successfully");
        } else {
            info!("TaloraDB database already exists");
        }
        
        // Switch to TaloraDB database
        let use_db_query = "USE TaloraDB";
        let query = tiberius::Query::new(use_db_query);
        query.execute(&mut *conn).await?;
        
        // Check if urls table exists, create if not
        let table_check_query = "
            SELECT COUNT(*) as table_exists 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'urls'
        ";
        
        let query = tiberius::Query::new(table_check_query);
        let stream = query.query(&mut *conn).await?;
        let row = stream.into_first_result().await?;
        
        let table_exists = if let Some(row) = row.into_iter().next() {
            let count: i32 = row.get(0).unwrap_or(0);
            count > 0
        } else {
            false
        };
        
        if !table_exists {
            info!("Creating urls table...");
            let create_table_query = "
                CREATE TABLE urls (
                    id BIGINT IDENTITY(1,1) PRIMARY KEY,
                    original_url NVARCHAR(2048) NOT NULL,
                    shortened_url NVARCHAR(255) NOT NULL UNIQUE,
                    created_at DATETIME2 DEFAULT GETUTCDATE(),
                    updated_at DATETIME2 DEFAULT GETUTCDATE()
                );
                
                CREATE INDEX IX_urls_shortened_url ON urls(shortened_url);
                CREATE INDEX IX_urls_created_at ON urls(created_at);
            ";
            let query = tiberius::Query::new(create_table_query);
            query.execute(&mut *conn).await?;
            info!("urls table and indexes created successfully");
        } else {
            info!("urls table already exists");
        }
        
        info!("Database initialization completed");
        Ok(())
    }

    pub async fn insert_url(pool: &DatabasePool, original_url: &str, shortened_url: &str) -> Result<i64> {
        let mut conn = pool.get().await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;
            
        let query = "
            USE TaloraDB;
            INSERT INTO urls (original_url, shortened_url) 
            OUTPUT INSERTED.id
            VALUES (@P1, @P2)
        ";

        let mut query = tiberius::Query::new(query);
        query.bind(original_url);
        query.bind(shortened_url);

        let stream = query.query(&mut *conn).await?;
        let row = stream.into_first_result().await?;
        
        if let Some(row) = row.into_iter().next() {
            let id: i64 = row.get(0).unwrap();
            info!("Inserted URL with ID: {}", id);
            Ok(id)
        } else {
            Err(anyhow::anyhow!("Failed to insert URL"))
        }
    }

    pub async fn get_original_url(pool: &DatabasePool, shortened_url: &str) -> Result<Option<String>> {
        let mut conn = pool.get().await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;
            
        let query = "USE TaloraDB; SELECT original_url FROM urls WHERE shortened_url = @P1";

        let mut query = tiberius::Query::new(query);
        query.bind(shortened_url);

        let stream = query.query(&mut *conn).await?;
        let row = stream.into_first_result().await?;

        if let Some(row) = row.into_iter().next() {
            let original_url: &str = row.get(0).unwrap();
            Ok(Some(original_url.to_string()))
        } else {
            Ok(None)
        }
    }

    pub async fn url_exists(pool: &DatabasePool, shortened_url: &str) -> Result<bool> {
        let mut conn = pool.get().await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;
            
        let query = "USE TaloraDB; SELECT COUNT(*) FROM urls WHERE shortened_url = @P1";

        let mut query = tiberius::Query::new(query);
        query.bind(shortened_url);

        let stream = query.query(&mut *conn).await?;
        let row = stream.into_first_result().await?;

        if let Some(row) = row.into_iter().next() {
            let count: i32 = row.get(0).unwrap();
            Ok(count > 0)
        } else {
            Ok(false)
        }
    }
}