use anyhow::Result;
use log::info;
use serde::{Deserialize, Serialize};
use std::env;
use tiberius::{Client, Config};
use tokio::net::TcpStream;
use tokio_util::compat::{Compat, TokioAsyncWriteCompatExt};

pub type DatabaseClient = Client<Compat<TcpStream>>;

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
}

impl DatabaseConfig {
    pub fn from_env() -> Result<Self> {
        let connection_string = env::var("DATABASE_URL")
            .map_err(|_| anyhow::anyhow!("DATABASE_URL environment variable not set"))?;
        
        Ok(DatabaseConfig {
            connection_string,
        })
    }
}

pub async fn create_connection(config: &DatabaseConfig) -> Result<DatabaseClient> {
    info!("Connecting to SQL Server database...");
    
    let config = Config::from_ado_string(&config.connection_string)?;
    let tcp = TcpStream::connect(config.get_addr()).await?;
    let mut client = Client::connect(config, tcp.compat_write()).await?;
    
    // Test the connection with a simple query to ensure database is ready
    info!("Testing database connection...");
    let query = tiberius::Query::new("SELECT 1 as test");
    let stream = query.query(&mut client).await
        .map_err(|e| anyhow::anyhow!("Database connection test failed: {}", e))?;
    
    // Consume the stream to complete the query
    let _rows = stream.into_first_result().await?;
    
    info!("Successfully connected to SQL Server database");
    Ok(client)
}

pub struct DatabaseService {
    client: DatabaseClient,
}

impl DatabaseService {
    pub fn new(client: DatabaseClient) -> Self {
        Self { client }
    }

    pub async fn initialize_database(&mut self) -> Result<()> {
        info!("Initializing database schema...");
        
        // Check if TaloraDB database exists, create if not
        let db_check_query = "
            SELECT COUNT(*) as db_exists 
            FROM sys.databases 
            WHERE name = 'TaloraDB'
        ";
        
        let query = tiberius::Query::new(db_check_query);
        let stream = query.query(&mut self.client).await?;
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
            query.execute(&mut self.client).await?;
            info!("TaloraDB database created successfully");
        } else {
            info!("TaloraDB database already exists");
        }
        
        // Switch to TaloraDB database
        let use_db_query = "USE TaloraDB";
        let query = tiberius::Query::new(use_db_query);
        query.execute(&mut self.client).await?;
        
        // Check if urls table exists, create if not
        let table_check_query = "
            SELECT COUNT(*) as table_exists 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'urls'
        ";
        
        let query = tiberius::Query::new(table_check_query);
        let stream = query.query(&mut self.client).await?;
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
            query.execute(&mut self.client).await?;
            info!("urls table and indexes created successfully");
        } else {
            info!("urls table already exists");
        }
        
        info!("Database initialization completed");
        Ok(())
    }

    pub async fn insert_url(&mut self, original_url: &str, shortened_url: &str) -> Result<i64> {
        let query = "
            INSERT INTO urls (original_url, shortened_url) 
            OUTPUT INSERTED.id
            VALUES (@P1, @P2)
        ";

        let mut query = tiberius::Query::new(query);
        query.bind(original_url);
        query.bind(shortened_url);

        let stream = query.query(&mut self.client).await?;
        let row = stream.into_first_result().await?;
        
        if let Some(row) = row.into_iter().next() {
            let id: i64 = row.get(0).unwrap();
            info!("Inserted URL with ID: {}", id);
            Ok(id)
        } else {
            Err(anyhow::anyhow!("Failed to insert URL"))
        }
    }

    pub async fn get_original_url(&mut self, shortened_url: &str) -> Result<Option<String>> {
        let query = "SELECT original_url FROM urls WHERE shortened_url = @P1";

        let mut query = tiberius::Query::new(query);
        query.bind(shortened_url);

        let stream = query.query(&mut self.client).await?;
        let row = stream.into_first_result().await?;

        if let Some(row) = row.into_iter().next() {
            let original_url: &str = row.get(0).unwrap();
            Ok(Some(original_url.to_string()))
        } else {
            Ok(None)
        }
    }

    pub async fn url_exists(&mut self, shortened_url: &str) -> Result<bool> {
        let query = "SELECT COUNT(*) FROM urls WHERE shortened_url = @P1";

        let mut query = tiberius::Query::new(query);
        query.bind(shortened_url);

        let stream = query.query(&mut self.client).await?;
        let row = stream.into_first_result().await?;

        if let Some(row) = row.into_iter().next() {
            let count: i32 = row.get(0).unwrap();
            Ok(count > 0)
        } else {
            Ok(false)
        }
    }
}