use actix_cors::Cors;
use actix_web::{middleware::Logger, web, App, HttpResponse, HttpServer, Result};
use log::info;
use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use url::Url;

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

// In-memory storage for URL mappings
type UrlStorage = Arc<Mutex<HashMap<String, String>>>;

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
    storage: web::Data<UrlStorage>,
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

    // Generate unique short ID
    let short_id = generate_short_id();

    // Store the mapping
    {
        let mut storage = storage.lock().unwrap();
        storage.insert(short_id.clone(), original_url.to_string());
    }

    info!("Created short URL {short_id} for {original_url}");

    // Return the shortened URL
    Ok(HttpResponse::Ok().json(ShortenResponse {
        short_url: format!("http://localhost:8080/shortened-url/{short_id}"),
        original_url: original_url.to_string(),
    }))
}

// GET /shortened-url/{id} endpoint
async fn redirect_url(
    path: web::Path<String>,
    storage: web::Data<UrlStorage>,
) -> Result<HttpResponse> {
    let short_id = path.into_inner();

    info!("Received redirect request for short ID: {short_id}");

    // Look up the original URL
    let original_url = {
        let storage = storage.lock().unwrap();
        storage.get(&short_id).cloned()
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
    // Initialize logger
    env_logger::init();

    info!("Starting Thalora URL Shortener Backend");

    // Create shared storage
    let storage: UrlStorage = Arc::new(Mutex::new(HashMap::new()));

    // Start HTTP server
    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin("http://localhost:3000") // Frontend development server
            .allowed_methods(vec!["GET", "POST"])
            .allowed_headers(vec!["content-type"])
            .max_age(3600);

        App::new()
            .app_data(web::Data::new(storage.clone()))
            .wrap(cors)
            .wrap(Logger::default())
            .route("/health", web::get().to(health_check))
            .route("/shorten", web::post().to(shorten_url))
            .route("/shortened-url/{id}", web::get().to(redirect_url))
    })
    .bind("127.0.0.1:8080")?
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
