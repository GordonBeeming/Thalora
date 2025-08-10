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

#[derive(Serialize)]
struct ShortenResponse {
    short_url: String,
    original_url: String,
}

#[derive(Serialize)]
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

// Validate URL format
fn is_valid_url(url_str: &str) -> bool {
    match Url::parse(url_str) {
        Ok(url) => {
            // Ensure it's http or https
            matches!(url.scheme(), "http" | "https")
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
            error: "Invalid URL format. URL must start with http:// or https://".to_string(),
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
        App::new()
            .app_data(web::Data::new(storage.clone()))
            .wrap(Logger::default())
            .route("/health", web::get().to(health_check))
            .route("/shorten", web::post().to(shorten_url))
            .route("/shortened-url/{id}", web::get().to(redirect_url))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
