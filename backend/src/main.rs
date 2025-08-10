use actix_cors::Cors;
use actix_web::{middleware::Logger, web, App, HttpRequest, HttpResponse, HttpServer, Result};
use log::{error, info, warn};
use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use url::Url;

mod database;
use database::{create_connection, DatabaseConfig, DatabaseService};

// Data structures for request/response
#[derive(Deserialize)]
struct ShortenRequest {
    url: String,
}

#[derive(Serialize, Deserialize)]
struct ShortenResponse {
    short_url: String,
    original_url: String,
}

#[derive(Serialize, Deserialize)]
struct ErrorResponse {
    error: String,
}

// Database service for URL mappings
type DatabasePool = Arc<Mutex<DatabaseService>>;

// Generate a random shortened URL identifier
fn generate_short_id() -> String {
    thread_rng()
        .sample_iter(&Alphanumeric)
        .take(8)
        .map(char::from)
        .collect()
}

// Validate URL format - HTTPS only for security
fn is_valid_url(url_str: &str) -> bool {
    match Url::parse(url_str) {
        Ok(url) => {
            // Only accept HTTPS URLs for security
            url.scheme() == "https"
        }
        Err(_) => false,
    }
}

// POST /shorten endpoint
async fn shorten_url(
    req: web::Json<ShortenRequest>,
    http_req: HttpRequest,
    db_pool: web::Data<DatabasePool>,
) -> Result<HttpResponse> {
    let original_url = req.url.trim();

    // Log the incoming request
    info!("Received shorten request for URL: {original_url}");

    // Validate URL
    if original_url.is_empty() {
        info!("Empty URL provided");
        return Ok(HttpResponse::BadRequest().json(ErrorResponse {
            error: "URL cannot be empty".to_string(),
        }));
    }

    if !is_valid_url(original_url) {
        info!("Invalid URL provided: {original_url}");
        return Ok(HttpResponse::BadRequest().json(ErrorResponse {
            error: "Invalid URL format. Only HTTPS URLs are supported for security reasons.".to_string(),
        }));
    }

    // Generate unique short ID, ensuring it's not already used
    let short_id = loop {
        let candidate = generate_short_id();
        
        // Check if this ID already exists in the database
        let mut db_service = match db_pool.lock() {
            Ok(service) => service,
            Err(e) => {
                error!("Failed to acquire database lock: {}", e);
                return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                    error: "Database connection error".to_string(),
                }));
            }
        };

        match db_service.url_exists(&candidate).await {
            Ok(exists) => {
                if !exists {
                    break candidate;
                }
                // If it exists, continue the loop to generate a new one
                warn!("Generated short ID {} already exists, trying again", candidate);
            }
            Err(e) => {
                error!("Database error checking URL existence: {}", e);
                return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                    error: "Database error".to_string(),
                }));
            }
        }
    };

    // Store the mapping in the database
    {
        let mut db_service = match db_pool.lock() {
            Ok(service) => service,
            Err(e) => {
                error!("Failed to acquire database lock: {}", e);
                return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                    error: "Database connection error".to_string(),
                }));
            }
        };

        match db_service.insert_url(original_url, &short_id).await {
            Ok(id) => {
                info!("Created short URL {} for {} with database ID {}", short_id, original_url, id);
            }
            Err(e) => {
                error!("Failed to store URL in database: {}", e);
                return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                    error: "Failed to store URL".to_string(),
                }));
            }
        }
    }

    // Build the base URL from the current request context
    let connection_info = http_req.connection_info();
    let scheme = connection_info.scheme();
    let host = connection_info.host();
    
    // Fallback to localhost:8080 if connection info is not reliable
    let base_url = if host.is_empty() || scheme.is_empty() {
        info!("Connection info not reliable (scheme: '{}', host: '{}'), falling back to localhost:8080", scheme, host);
        "http://localhost:8080".to_string()
    } else {
        format!("{}://{}", scheme, host)
    };

    // Return the shortened URL
    Ok(HttpResponse::Ok().json(ShortenResponse {
        short_url: format!("{}/shortened-url/{}", base_url, short_id),
        original_url: original_url.to_string(),
    }))
}

// GET /shortened-url/{id} endpoint
async fn redirect_url(
    path: web::Path<String>,
    db_pool: web::Data<DatabasePool>,
) -> Result<HttpResponse> {
    let short_id = path.into_inner();

    info!("Received redirect request for short ID: {short_id}");

    // Look up the original URL in the database
    let original_url = {
        let mut db_service = match db_pool.lock() {
            Ok(service) => service,
            Err(e) => {
                error!("Failed to acquire database lock: {}", e);
                return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                    error: "Database connection error".to_string(),
                }));
            }
        };

        match db_service.get_original_url(&short_id).await {
            Ok(url) => url,
            Err(e) => {
                error!("Database error retrieving URL for {}: {}", short_id, e);
                return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                    error: "Database error".to_string(),
                }));
            }
        }
    };

    match original_url {
        Some(url) => {
            info!("Redirecting {short_id} to {url}");
            Ok(HttpResponse::Found()
                .append_header(("Location", url))
                .finish())
        }
        None => {
            info!("Short ID not found: {short_id}");
            Ok(HttpResponse::NotFound().json(ErrorResponse {
                error: "Short URL not found".to_string(),
            }))
        }
    }
}

// Health check endpoint
async fn health_check() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "thalora-backend"
    })))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load environment variables from .env file if it exists
    dotenv::dotenv().ok();

    // Initialize logger
    env_logger::init();

    info!("Starting Thalora URL Shortener Backend");

    // Initialize database configuration
    let db_config = match DatabaseConfig::from_env() {
        Ok(config) => config,
        Err(e) => {
            error!("Failed to load database configuration: {}", e);
            error!("Make sure DATABASE_URL is set in environment or .env file");
            std::process::exit(1);
        }
    };

    // Create database connection
    let db_client = match create_connection(&db_config).await {
        Ok(client) => client,
        Err(e) => {
            error!("Failed to connect to database: {}", e);
            error!("Make sure SQL Server is running and accessible");
            std::process::exit(1);
        }
    };

    // Create database service
    let db_service = DatabaseService::new(db_client);
    let db_pool: DatabasePool = Arc::new(Mutex::new(db_service));

    info!("Database connection established successfully");

    // Get server configuration from environment or use defaults
    let host = std::env::var("SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("SERVER_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);
    
    let bind_address = format!("{}:{}", host, port);
    info!("Server will bind to: {}", bind_address);

    // Start HTTP server
    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin("http://localhost:3000") // Frontend development server
            .allowed_methods(vec!["GET", "POST", "OPTIONS"]) // Add OPTIONS for preflight
            .allowed_headers(vec!["content-type", "accept", "origin", "x-requested-with"])
            .max_age(3600);

        App::new()
            .app_data(web::Data::new(db_pool.clone()))
            .wrap(cors)
            .wrap(Logger::default())
            .route("/health", web::get().to(health_check))
            .route("/shorten", web::post().to(shorten_url))
            .route("/shortened-url/{id}", web::get().to(redirect_url))
    })
    .bind(&bind_address)?
    .run()
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_is_valid_url() {
        // Valid HTTPS URLs
        assert!(is_valid_url("https://www.example.com"));
        assert!(is_valid_url("https://example.com"));
        assert!(is_valid_url("https://subdomain.example.com/path"));
        assert!(is_valid_url("https://subdomain.example.com/path?query=1"));
        assert!(is_valid_url("https://subdomain.example.com/path#fragment"));
        
        // Invalid HTTP URLs (should be rejected)
        assert!(!is_valid_url("http://www.example.com"));
        assert!(!is_valid_url("http://example.com"));
        
        // Invalid formats
        assert!(!is_valid_url("not-a-url"));
        assert!(!is_valid_url(""));
        assert!(!is_valid_url("ftp://example.com"));
        assert!(!is_valid_url("www.example.com")); // No protocol
        assert!(!is_valid_url("://example.com")); // Missing scheme
    }

    #[test]
    fn test_generate_short_id() {
        let id1 = generate_short_id();
        let id2 = generate_short_id();
        
        // Should be 8 characters long
        assert_eq!(id1.len(), 8);
        assert_eq!(id2.len(), 8);
        
        // Should be different (very high probability)
        assert_ne!(id1, id2);
        
        // Should only contain alphanumeric characters
        assert!(id1.chars().all(|c| c.is_ascii_alphanumeric()));
        assert!(id2.chars().all(|c| c.is_ascii_alphanumeric()));
    }

    #[test]
    fn test_generate_multiple_short_ids_unique() {
        let mut ids = std::collections::HashSet::new();
        
        // Generate 100 IDs and ensure they're all unique
        for _ in 0..100 {
            let id = generate_short_id();
            assert_eq!(id.len(), 8);
            assert!(id.chars().all(|c| c.is_ascii_alphanumeric()));
            assert!(ids.insert(id), "Generated duplicate ID");
        }
    }

    #[test]
    fn test_url_validation_edge_cases() {
        // Test various edge cases for URL validation
        
        // Valid HTTPS cases
        assert!(is_valid_url("https://127.0.0.1"));
        assert!(is_valid_url("https://localhost:8080"));
        assert!(is_valid_url("https://example.co.uk/path"));
        assert!(is_valid_url("https://sub.example.com:443/path?a=1&b=2#section"));
        
        // Invalid cases
        assert!(!is_valid_url(""));
        assert!(!is_valid_url("   "));
        assert!(!is_valid_url("https://"));
        assert!(!is_valid_url("file:///path/to/file"));
        assert!(!is_valid_url("data:text/plain,hello"));
        assert!(!is_valid_url("javascript:alert('xss')"));
        
        // HTTP should be rejected
        assert!(!is_valid_url("http://secure-site.com"));
        assert!(!is_valid_url("http://127.0.0.1:8080"));
    }
}
