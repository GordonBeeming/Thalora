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
    let client = Client::connect(config, tcp.compat_write()).await?;
    
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