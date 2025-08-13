use anyhow::Result;
use bb8::Pool;
use bb8_tiberius::ConnectionManager;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::env;
use tiberius::Config;
use chrono::{DateTime, Utc};

pub type DatabasePool = Pool<ConnectionManager>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UrlEntry {
    pub id: i64,
    pub original_url: String,
    pub shortened_url: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainEntry {
    pub id: i64,
    pub user_id: Option<i64>,
    pub domain_name: String,
    pub is_verified: bool,
    pub verification_token: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserEntry {
    pub id: i64,
    pub username: String,
    pub email: String,
    pub passkey_public_key: Vec<u8>,
    pub passkey_credential_id: Vec<u8>,
    pub passkey_counter: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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

        // Validate connection string has database parameter
        Self::validate_database_name(&base_connection_string)?;

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
                    .to_lowercase()
                    == "production";
                is_production
            });

        // Build connection string with appropriate encryption settings
        let connection_string = Self::build_connection_string_with_encryption(
            &base_connection_string,
            encryption_enabled,
        );

        info!("Database encryption enabled: {}", encryption_enabled);
        if !encryption_enabled {
            warn!(
                "Database encryption is DISABLED. This should only be used for local development."
            );
        }

        Ok(DatabaseConfig {
            connection_string,
            max_connections,
            min_connections,
            encryption_enabled,
        })
    }

    fn validate_database_name(connection_string: &str) -> Result<()> {
        // Parse the connection string to find the Database parameter
        for part in connection_string.split(';') {
            let part = part.trim();
            if part.len() >= 9 && part[..9].eq_ignore_ascii_case("database=") {
                let db_name = part.split('=').nth(1).unwrap_or("").trim();
                if db_name.is_empty() {
                    return Err(anyhow::anyhow!("Empty database name in connection string"));
                }
                return Ok(());
            }
        }
        Err(anyhow::anyhow!("No Database parameter found in connection string. Connection string must include Database=<database_name>"))
    }

    fn build_connection_string_with_encryption(
        base_connection_string: &str,
        encryption_enabled: bool,
    ) -> String {
        // Parse the connection string into key-value pairs
        let mut params: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        
        for part in base_connection_string.split(';') {
            let part = part.trim();
            if part.is_empty() {
                continue;
            }
            
            if let Some((key, value)) = part.split_once('=') {
                let key = key.trim().to_lowercase();
                let value = value.trim().to_string();
                if !key.is_empty() && !value.is_empty() {
                    params.insert(key, value);
                }
            }
        }

        // Set encryption parameters based on the flag
        if encryption_enabled {
            // Production: use encryption with certificate trust
            params.insert("encrypt".to_string(), "yes".to_string());
            params.insert("trustservercertificate".to_string(), "true".to_string());
        } else {
            // Development: disable encryption for compatibility with SQL Server 2022 in Docker
            params.insert("encrypt".to_string(), "no".to_string());
            params.insert("trustservercertificate".to_string(), "yes".to_string());
        }

        // Rebuild the connection string
        let mut parts: Vec<String> = params.into_iter()
            .map(|(key, value)| {
                // Restore original casing for common parameters
                let key = match key.as_str() {
                    "server" => "Server",
                    "database" => "Database",
                    "user" => "User",
                    "password" => "Password",
                    "encrypt" => "Encrypt",
                    "trustservercertificate" => "TrustServerCertificate",
                    _ => &key,
                };
                format!("{}={}", key, value)
            })
            .collect();
        
        // Sort to ensure consistent ordering (important for testing)
        parts.sort();
        
        parts.join(";")
    }
}

pub async fn create_connection_pool(config: &DatabaseConfig) -> Result<DatabasePool> {
    info!(
        "Creating database connection pool with {}-{} connections...",
        config.min_connections, config.max_connections
    );

    // Parse connection string for Tiberius
    let mut tiberius_config =
        Config::from_ado_string(&config.connection_string)
            .map_err(|e| anyhow::anyhow!("Invalid DATABASE_URL format: {}", e))?;
    if !config.encryption_enabled {
        tiberius_config.encryption(tiberius::EncryptionLevel::NotSupported);
    }

    // Create connection manager with the config
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
        let mut conn = pool
            .get()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;

        let query = tiberius::Query::new("SELECT 1 as test");
        let stream = query
            .query(&mut *conn)
            .await
            .map_err(|e| anyhow::anyhow!("Database connection test failed: {}", e))?;

        let _rows = stream.into_first_result().await?;
        info!("Connection pool test successful");
    }

    Ok(pool)
}

pub struct DatabaseService;

impl DatabaseService {

    pub async fn insert_url(
        pool: &DatabasePool,
        original_url: &str,
        shortened_url: &str,
    ) -> Result<i64> {
        let mut conn = pool
            .get()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;

        let query = "
            INSERT INTO urls (original_url, shortened_url) 
            OUTPUT INSERTED.id
            VALUES (@P1, @P2)";

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

    pub async fn get_original_url(
        pool: &DatabasePool,
        shortened_url: &str,
    ) -> Result<Option<String>> {
        let mut conn = pool
            .get()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;

        let query = "SELECT original_url FROM urls WHERE shortened_url = @P1";

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
        let mut conn = pool
            .get()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;

        let query = "SELECT COUNT(*) FROM urls WHERE shortened_url = @P1";

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

    // Domain management methods
    pub async fn insert_domain(
        pool: &DatabasePool,
        domain_name: &str,
        user_id: Option<i64>,
        is_verified: bool,
        verification_token: Option<String>,
    ) -> Result<i64> {
        let mut conn = pool
            .get()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;

        let query = "
            INSERT INTO domains (domain_name, user_id, is_verified, verification_token) 
            OUTPUT INSERTED.id
            VALUES (@P1, @P2, @P3, @P4)";

        let mut query = tiberius::Query::new(query);
        query.bind(domain_name);
        query.bind(user_id);
        query.bind(is_verified);
        query.bind(verification_token);

        let stream = query.query(&mut *conn).await?;
        let row = stream.into_first_result().await?;

        if let Some(row) = row.into_iter().next() {
            let id: i64 = row.get(0).unwrap();
            info!("Inserted domain '{}' with ID: {}", domain_name, id);
            Ok(id)
        } else {
            Err(anyhow::anyhow!("Failed to insert domain"))
        }
    }

    pub async fn get_domain_by_name(
        pool: &DatabasePool,
        domain_name: &str,
    ) -> Result<Option<DomainEntry>> {
        let mut conn = pool
            .get()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;

        let query = "
            SELECT id, user_id, domain_name, is_verified, verification_token, created_at, updated_at 
            FROM domains 
            WHERE domain_name = @P1";

        let mut query = tiberius::Query::new(query);
        query.bind(domain_name);

        let stream = query.query(&mut *conn).await?;
        let row = stream.into_first_result().await?;

        if let Some(row) = row.into_iter().next() {
            let id: i64 = row.get(0).unwrap();
            let user_id: Option<i64> = row.get(1);
            let domain_name: &str = row.get(2).unwrap();
            let is_verified: bool = row.get(3).unwrap();
            let verification_token: Option<&str> = row.get(4);
            let created_at: chrono::DateTime<chrono::Utc> = row.get(5).unwrap();
            let updated_at: chrono::DateTime<chrono::Utc> = row.get(6).unwrap();

            Ok(Some(DomainEntry {
                id,
                user_id,
                domain_name: domain_name.to_string(),
                is_verified,
                verification_token: verification_token.map(|s| s.to_string()),
                created_at,
                updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn get_domain_by_id(
        pool: &DatabasePool,
        domain_id: i64,
    ) -> Result<Option<DomainEntry>> {
        let mut conn = pool
            .get()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;

        let query_sql = "
            SELECT id, user_id, domain_name, is_verified, verification_token, created_at, updated_at 
            FROM domains 
            WHERE id = @P1";

        let mut query = tiberius::Query::new(query_sql);
        query.bind(domain_id);

        let stream = query.query(&mut *conn).await?;
        let rows = stream.into_first_result().await?;

        if let Some(row) = rows.into_iter().next() {
            let id: i64 = row.get(0).unwrap();
            let user_id: Option<i64> = row.get(1);
            let domain_name: &str = row.get(2).unwrap();
            let is_verified: bool = row.get(3).unwrap();
            let verification_token: Option<&str> = row.get(4);
            let created_at: chrono::DateTime<chrono::Utc> = row.get(5).unwrap();
            let updated_at: chrono::DateTime<chrono::Utc> = row.get(6).unwrap();

            Ok(Some(DomainEntry {
                id,
                user_id,
                domain_name: domain_name.to_string(),
                is_verified,
                verification_token: verification_token.map(|s| s.to_string()),
                created_at,
                updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn get_verified_domains(pool: &DatabasePool) -> Result<Vec<DomainEntry>> {
        let mut conn = pool
            .get()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;

        let query = "
            SELECT id, user_id, domain_name, is_verified, verification_token, created_at, updated_at 
            FROM domains 
            WHERE is_verified = 1
            ORDER BY created_at DESC";

        let query = tiberius::Query::new(query);
        let stream = query.query(&mut *conn).await?;
        let rows = stream.into_first_result().await?;

        let mut domains = Vec::new();
        for row in rows {
            let id: i64 = row.get(0).unwrap();
            let user_id: Option<i64> = row.get(1);
            let domain_name: &str = row.get(2).unwrap();
            let is_verified: bool = row.get(3).unwrap();
            let verification_token: Option<&str> = row.get(4);
            let created_at: chrono::DateTime<chrono::Utc> = row.get(5).unwrap();
            let updated_at: chrono::DateTime<chrono::Utc> = row.get(6).unwrap();

            domains.push(DomainEntry {
                id,
                user_id,
                domain_name: domain_name.to_string(),
                is_verified,
                verification_token: verification_token.map(|s| s.to_string()),
                created_at,
                updated_at,
            });
        }

        Ok(domains)
    }

    pub async fn get_all_domains(pool: &DatabasePool) -> Result<Vec<DomainEntry>> {
        let mut conn = pool
            .get()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;

        let query = "
            SELECT id, user_id, domain_name, is_verified, verification_token, created_at, updated_at 
            FROM domains 
            ORDER BY created_at DESC";

        let query = tiberius::Query::new(query);
        let stream = query.query(&mut *conn).await?;
        let rows = stream.into_first_result().await?;

        let mut domains = Vec::new();
        for row in rows {
            let id: i64 = row.get(0).unwrap();
            let user_id: Option<i64> = row.get(1);
            let domain_name: &str = row.get(2).unwrap();
            let is_verified: bool = row.get(3).unwrap();
            let verification_token: Option<&str> = row.get(4);
            let created_at: chrono::DateTime<chrono::Utc> = row.get(5).unwrap();
            let updated_at: chrono::DateTime<chrono::Utc> = row.get(6).unwrap();

            domains.push(DomainEntry {
                id,
                user_id,
                domain_name: domain_name.to_string(),
                is_verified,
                verification_token: verification_token.map(|s| s.to_string()),
                created_at,
                updated_at,
            });
        }

        Ok(domains)
    }

    pub async fn update_domain_verification_by_id(
        pool: &DatabasePool,
        domain_id: i64,
        is_verified: bool,
    ) -> Result<bool> {
        let mut conn = pool
            .get()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;

        let query = "
            UPDATE domains 
            SET is_verified = @P2, updated_at = GETUTCDATE()
            WHERE id = @P1";

        let mut query = tiberius::Query::new(query);
        query.bind(domain_id);
        query.bind(is_verified);

        let result = query.execute(&mut *conn).await?;
        Ok(result.rows_affected().len() > 0)
    }

    // User management methods
    pub async fn create_user(
        pool: &DatabasePool,
        username: &str,
        email: &str,
        passkey_public_key: &[u8],
        passkey_credential_id: &[u8],
        passkey_counter: u32,
    ) -> Result<i64> {
        let mut conn = pool
            .get()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;

        let query = "
            INSERT INTO users (username, email, passkey_public_key, passkey_credential_id, passkey_counter) 
            OUTPUT INSERTED.id
            VALUES (@P1, @P2, @P3, @P4, @P5)";

        let mut query = tiberius::Query::new(query);
        query.bind(username);
        query.bind(email);
        query.bind(passkey_public_key);
        query.bind(passkey_credential_id);
        query.bind(passkey_counter as i64);

        let stream = query.query(&mut *conn).await?;
        let row = stream.into_first_result().await?;

        if let Some(row) = row.into_iter().next() {
            let id: i64 = row.get(0).unwrap();
            info!("Created user '{}' with ID: {}", username, id);
            Ok(id)
        } else {
            Err(anyhow::anyhow!("Failed to create user"))
        }
    }

    pub async fn get_user_by_id(pool: &DatabasePool, user_id: i64) -> Result<Option<UserEntry>> {
        let mut conn = pool
            .get()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;

        let query = "
            SELECT id, username, email, passkey_public_key, passkey_credential_id, passkey_counter, created_at, updated_at
            FROM users 
            WHERE id = @P1";

        let mut query = tiberius::Query::new(query);
        query.bind(user_id);

        let stream = query.query(&mut *conn).await?;
        let row = stream.into_first_result().await?;

        if let Some(row) = row.into_iter().next() {
            let id: i64 = row.get(0).unwrap();
            let username: &str = row.get(1).unwrap();
            let email: &str = row.get(2).unwrap();
            let passkey_public_key: &[u8] = row.get(3).unwrap();
            let passkey_credential_id: &[u8] = row.get(4).unwrap();
            let passkey_counter: i64 = row.get(5).unwrap();
            let created_at: DateTime<Utc> = row.get(6).unwrap();
            let updated_at: DateTime<Utc> = row.get(7).unwrap();

            Ok(Some(UserEntry {
                id,
                username: username.to_string(),
                email: email.to_string(),
                passkey_public_key: passkey_public_key.to_vec(),
                passkey_credential_id: passkey_credential_id.to_vec(),
                passkey_counter: passkey_counter as u32,
                created_at,
                updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn get_user_by_username(
        pool: &DatabasePool,
        username: &str,
    ) -> Result<Option<UserEntry>> {
        let mut conn = pool
            .get()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;

        let query = "
            SELECT id, username, email, passkey_public_key, passkey_credential_id, passkey_counter, created_at, updated_at
            FROM users 
            WHERE username = @P1";

        let mut query = tiberius::Query::new(query);
        query.bind(username);

        let stream = query.query(&mut *conn).await?;
        let row = stream.into_first_result().await?;

        if let Some(row) = row.into_iter().next() {
            let id: i64 = row.get(0).unwrap();
            let username: &str = row.get(1).unwrap();
            let email: &str = row.get(2).unwrap();
            let passkey_public_key: &[u8] = row.get(3).unwrap();
            let passkey_credential_id: &[u8] = row.get(4).unwrap();
            let passkey_counter: i64 = row.get(5).unwrap();
            let created_at: DateTime<Utc> = row.get(6).unwrap();
            let updated_at: DateTime<Utc> = row.get(7).unwrap();

            Ok(Some(UserEntry {
                id,
                username: username.to_string(),
                email: email.to_string(),
                passkey_public_key: passkey_public_key.to_vec(),
                passkey_credential_id: passkey_credential_id.to_vec(),
                passkey_counter: passkey_counter as u32,
                created_at,
                updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn get_user_by_email(
        pool: &DatabasePool,
        email: &str,
    ) -> Result<Option<UserEntry>> {
        let mut conn = pool
            .get()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;

        let query = "
            SELECT id, username, email, passkey_public_key, passkey_credential_id, passkey_counter, created_at, updated_at
            FROM users 
            WHERE email = @P1";

        let mut query = tiberius::Query::new(query);
        query.bind(email);

        let stream = query.query(&mut *conn).await?;
        let row = stream.into_first_result().await?;

        if let Some(row) = row.into_iter().next() {
            let id: i64 = row.get(0).unwrap();
            let username: &str = row.get(1).unwrap();
            let email: &str = row.get(2).unwrap();
            let passkey_public_key: &[u8] = row.get(3).unwrap();
            let passkey_credential_id: &[u8] = row.get(4).unwrap();
            let passkey_counter: i64 = row.get(5).unwrap();
            let created_at: DateTime<Utc> = row.get(6).unwrap();
            let updated_at: DateTime<Utc> = row.get(7).unwrap();

            Ok(Some(UserEntry {
                id,
                username: username.to_string(),
                email: email.to_string(),
                passkey_public_key: passkey_public_key.to_vec(),
                passkey_credential_id: passkey_credential_id.to_vec(),
                passkey_counter: passkey_counter as u32,
                created_at,
                updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn update_user_counter(
        pool: &DatabasePool,
        user_id: i64,
        new_counter: u32,
    ) -> Result<bool> {
        let mut conn = pool
            .get()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get connection from pool: {}", e))?;

        let query = "
            UPDATE users 
            SET passkey_counter = @P2, updated_at = GETUTCDATE()
            WHERE id = @P1";

        let mut query = tiberius::Query::new(query);
        query.bind(user_id);
        query.bind(new_counter as i64);

        let result = query.execute(&mut *conn).await?;
        Ok(result.rows_affected().len() > 0)
    }
}
