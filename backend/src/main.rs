use actix_cors::Cors;
use actix_session::{config::PersistentSession, storage::CookieSessionStore, SessionMiddleware};
use actix_web::{
    cookie::Key, middleware::Logger, web, App, HttpRequest, HttpResponse, HttpServer, Result,
};
use log::{error, info, warn};
use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};
use serde::{Deserialize, Serialize};
use url::Url;

mod database;
mod auth;

use auth::auth::{login_begin, login_complete, logout, me, register_begin, register_complete};
use database::{create_connection_pool, DatabaseConfig, DatabasePool, DatabaseService};

// Data structures for request/response
#[derive(Deserialize)]
struct ShortenRequest {
    url: String,
    domain: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct ShortenResponse {
    short_url: String,
    original_url: String,
}

#[derive(Deserialize)]
struct AddDomainRequest {
    domain_name: String,
}

#[derive(Serialize, Deserialize)]
struct AddDomainResponse {
    id: i64,
    domain_name: String,
    is_verified: bool,
    verification_status: String,
}

#[derive(Serialize, Deserialize)]
struct ErrorResponse {
    error: String,
}

// Database service for URL mappings - now uses connection pool
type AppDatabasePool = web::Data<DatabasePool>;

// Domain validation service
struct DomainValidationService;

impl DomainValidationService {
    // Generate a verification token for DNS TXT record
    fn generate_verification_token() -> String {
        use rand::distributions::Alphanumeric;
        use rand::{thread_rng, Rng};

        format!(
            "thalora-verification-{}",
            thread_rng()
                .sample_iter(&Alphanumeric)
                .take(32)
                .map(char::from)
                .collect::<String>()
        )
    }

    // Basic domain validation - checks format and creates verification token
    async fn validate_domain(domain: &str) -> (bool, String, Option<String>) {
        // Basic format validation
        if domain.is_empty() {
            return (false, "Domain cannot be empty".to_string(), None);
        }

        if domain.len() > 253 {
            return (
                false,
                "Domain name too long (max 253 characters)".to_string(),
                None,
            );
        }

        // Check for valid domain format (basic)
        let domain_regex = regex::Regex::new(r"^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$").unwrap();
        if !domain_regex.is_match(domain) {
            return (false, "Invalid domain format".to_string(), None);
        }

        // Generate verification token
        let verification_token = Self::generate_verification_token();

        info!(
            "Domain '{}' passed basic validation. Verification token generated.",
            domain
        );
        (false, format!("Domain validation pending. Please create a TXT record: _thalora-verification.{} with value: {}", domain, verification_token), Some(verification_token))
    }

    // Check DNS TXT record for domain verification
    async fn verify_dns_txt_record(domain: &str, expected_token: &str) -> bool {
        info!(
            "Checking DNS TXT record for domain: {} with token: {}",
            domain, expected_token
        );

        // Check if verification should be skipped (development mode)
        if let Ok(skip_verification) = std::env::var("SKIP_DOMAIN_VERIFICATION") {
            if skip_verification.to_lowercase() == "true" {
                info!("DNS verification skipped (SKIP_DOMAIN_VERIFICATION=true)");
                return true;
            }
        }

        // Perform actual DNS TXT record lookup
        use trust_dns_resolver::config::*;
        use trust_dns_resolver::Resolver;

        let resolver = match Resolver::new(ResolverConfig::default(), ResolverOpts::default()) {
            Ok(resolver) => resolver,
            Err(e) => {
                error!("Failed to create DNS resolver: {}", e);
                return false;
            }
        };

        let lookup_name = format!("_thalora-verification.{}", domain);
        info!("Looking up TXT records for: {}", lookup_name);

        match resolver.txt_lookup(&lookup_name) {
            Ok(txt_records) => {
                info!(
                    "Found {} TXT records for {}",
                    txt_records.iter().count(),
                    lookup_name
                );

                for record in txt_records.iter() {
                    // Convert TXT record data to string
                    let txt_data: Vec<u8> = record
                        .txt_data()
                        .iter()
                        .flat_map(|data| data.iter())
                        .cloned()
                        .collect();

                    if let Ok(txt_string) = String::from_utf8(txt_data) {
                        let txt_value = txt_string.trim();
                        info!("Found TXT record value: '{}'", txt_value);

                        if txt_value == expected_token {
                            info!("✅ DNS verification successful for domain: {}", domain);
                            return true;
                        }
                    }
                }

                warn!("❌ DNS verification failed: expected token '{}' not found in TXT records for {}", expected_token, lookup_name);
                false
            }
            Err(e) => {
                warn!("❌ DNS lookup failed for {}: {}", lookup_name, e);
                false
            }
        }
    }
}

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
    db_pool: AppDatabasePool,
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
            error: "Invalid URL format. Only HTTPS URLs are supported for security reasons."
                .to_string(),
        }));
    }

    // Generate unique short ID, ensuring it's not already used
    let short_id = loop {
        let candidate = generate_short_id();

        // Check if this ID already exists in the database using the pool
        match DatabaseService::url_exists(&db_pool, &candidate).await {
            Ok(exists) => {
                if !exists {
                    break candidate;
                }
                // If it exists, continue the loop to generate a new one
                warn!(
                    "Generated short ID {} already exists, trying again",
                    candidate
                );
            }
            Err(e) => {
                error!("Database error checking URL existence: {}", e);
                return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                    error: "Database error".to_string(),
                }));
            }
        }
    };

    // Store the mapping in the database using the pool
    match DatabaseService::insert_url(&db_pool, original_url, &short_id).await {
        Ok(id) => {
            info!(
                "Created short URL {} for {} with database ID {}",
                short_id, original_url, id
            );
        }
        Err(e) => {
            error!("Failed to store URL in database: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Failed to store URL".to_string(),
            }));
        }
    }

    // Check for verified custom domains - use specified domain or first available one
    let base_url = match DatabaseService::get_verified_domains(&db_pool).await {
        Ok(domains) => {
            // If a specific domain was requested, try to use it
            if let Some(requested_domain) = &req.domain {
                if let Some(domain) = domains.iter().find(|d| d.domain_name == *requested_domain) {
                    info!("Using requested custom domain: {}", domain.domain_name);
                    format!("https://{}", domain.domain_name)
                } else {
                    // Requested domain not found or not verified
                    info!("Requested domain '{}' not found or not verified", requested_domain);
                    return Ok(HttpResponse::BadRequest().json(ErrorResponse {
                        error: format!("Domain '{}' is not verified or does not exist", requested_domain),
                    }));
                }
            } else if let Some(domain) = domains.first() {
                info!("Using first available custom domain: {}", domain.domain_name);
                format!("https://{}", domain.domain_name)
            } else {
                // Check if we allow fallback to localhost in development
                let skip_verification = std::env::var("SKIP_DOMAIN_VERIFICATION")
                    .unwrap_or_else(|_| "false".to_string())
                    .to_lowercase()
                    == "true";

                if skip_verification {
                    info!("No verified domains available, using localhost fallback (development mode)");
                    // Fall back to default domain in development
                    let connection_info = http_req.connection_info();
                    let scheme = connection_info.scheme();
                    let host = connection_info.host();

                    // Fallback to localhost:8080 if connection info is not reliable
                    if host.is_empty() || scheme.is_empty() {
                        info!("Connection info not reliable (scheme: '{}', host: '{}'), falling back to localhost:8080", scheme, host);
                        "http://localhost:8080".to_string()
                    } else {
                        format!("{}://{}", scheme, host)
                    }
                } else {
                    error!("No verified domains available and fallback disabled (production mode)");
                    return Ok(HttpResponse::BadRequest().json(ErrorResponse {
                        error: "No verified domains available for URL shortening. Please add and verify a custom domain first.".to_string(),
                    }));
                }
            }
        }
        Err(e) => {
            error!("Failed to retrieve domains: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Failed to retrieve domain information".to_string(),
            }));
        }
    };

    // Return the shortened URL
    Ok(HttpResponse::Ok().json(ShortenResponse {
        short_url: format!("{}/shortened-url/{}", base_url, short_id),
        original_url: original_url.to_string(),
    }))
}

// GET /shortened-url/{id} endpoint
async fn redirect_url(path: web::Path<String>, db_pool: AppDatabasePool) -> Result<HttpResponse> {
    let short_id = path.into_inner();

    info!("Received redirect request for short ID: {short_id}");

    // Look up the original URL in the database using the pool
    let original_url = match DatabaseService::get_original_url(&db_pool, &short_id).await {
        Ok(url) => url,
        Err(e) => {
            error!("Database error retrieving URL for {}: {}", short_id, e);
            return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Database error".to_string(),
            }));
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

// POST /domains endpoint - add a custom domain
async fn add_domain(
    req: web::Json<AddDomainRequest>,
    db_pool: AppDatabasePool,
) -> Result<HttpResponse> {
    let domain_name = req.domain_name.trim().to_lowercase();

    info!("Received add domain request for: {}", domain_name);

    // Basic validation
    if domain_name.is_empty() {
        return Ok(HttpResponse::BadRequest().json(ErrorResponse {
            error: "Domain name cannot be empty".to_string(),
        }));
    }

    // Check if domain already exists
    match DatabaseService::get_domain_by_name(&db_pool, &domain_name).await {
        Ok(Some(_)) => {
            return Ok(HttpResponse::Conflict().json(ErrorResponse {
                error: "Domain already exists".to_string(),
            }));
        }
        Ok(None) => {
            // Domain doesn't exist, continue
        }
        Err(e) => {
            error!("Database error checking domain existence: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Database error".to_string(),
            }));
        }
    }

    // Validate the domain
    let (is_verified, verification_message, verification_token) =
        DomainValidationService::validate_domain(&domain_name).await;

    // Store the domain in the database
    match DatabaseService::insert_domain(
        &db_pool,
        &domain_name,
        None,
        is_verified,
        verification_token.clone(),
    )
    .await
    {
        Ok(id) => {
            info!(
                "Added domain '{}' with ID: {}, verified: {}",
                domain_name, id, is_verified
            );

            Ok(HttpResponse::Ok().json(AddDomainResponse {
                id,
                domain_name: domain_name.clone(),
                is_verified,
                verification_status: verification_message,
            }))
        }
        Err(e) => {
            error!("Failed to store domain in database: {}", e);
            Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Failed to store domain".to_string(),
            }))
        }
    }
}

// GET /domains endpoint - list all domains
async fn list_domains(db_pool: AppDatabasePool) -> Result<HttpResponse> {
    match DatabaseService::get_all_domains(&db_pool).await {
        Ok(domains) => {
            info!("Retrieved {} domains", domains.len());
            Ok(HttpResponse::Ok().json(domains))
        }
        Err(e) => {
            error!("Failed to retrieve domains: {}", e);
            Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Failed to retrieve domains".to_string(),
            }))
        }
    }
}

// POST /domains/{id}/verify endpoint - verify a domain by checking DNS TXT record
async fn verify_domain(path: web::Path<i64>, db_pool: AppDatabasePool) -> Result<HttpResponse> {
    let domain_id = path.into_inner();

    info!("Received domain verification request for ID: {}", domain_id);

    // Get the domain from the database
    let domain = match DatabaseService::get_domain_by_id(&db_pool, domain_id).await {
        Ok(Some(domain)) => domain,
        Ok(None) => {
            return Ok(HttpResponse::NotFound().json(ErrorResponse {
                error: "Domain not found".to_string(),
            }));
        }
        Err(e) => {
            error!("Database error retrieving domain: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Database error".to_string(),
            }));
        }
    };

    if domain.is_verified {
        return Ok(HttpResponse::Ok().json(AddDomainResponse {
            id: domain.id,
            domain_name: domain.domain_name.clone(),
            is_verified: true,
            verification_status: "Domain is already verified".to_string(),
        }));
    }

    // Check if domain has a verification token
    let verification_token = match domain.verification_token {
        Some(token) => token,
        None => {
            return Ok(HttpResponse::BadRequest().json(ErrorResponse {
                error: "Domain has no verification token. Please re-add the domain.".to_string(),
            }));
        }
    };

    // Verify the DNS TXT record
    let is_verified =
        DomainValidationService::verify_dns_txt_record(&domain.domain_name, &verification_token)
            .await;

    if is_verified {
        // Update domain as verified in database
        match DatabaseService::update_domain_verification_by_id(&db_pool, domain_id, true).await {
            Ok(_) => {
                info!("✅ Domain '{}' successfully verified", domain.domain_name);
                Ok(HttpResponse::Ok().json(AddDomainResponse {
                    id: domain.id,
                    domain_name: domain.domain_name,
                    is_verified: true,
                    verification_status: "Domain successfully verified!".to_string(),
                }))
            }
            Err(e) => {
                error!("Failed to update domain verification status: {}", e);
                Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                    error: "Failed to update domain verification status".to_string(),
                }))
            }
        }
    } else {
        Ok(HttpResponse::BadRequest().json(ErrorResponse {
            error: format!(
                "Domain verification failed. Please ensure the TXT record '_thalora-verification.{}' contains the value: {}",
                domain.domain_name, verification_token
            ),
        }))
    }
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
            error!("Example: DATABASE_URL=Server=localhost,1433;Database=master;User=sa;Password=YourPassword;TrustServerCertificate=true;");
            error!("To set up a local SQL Server database, run: ./scripts/setup-dev-db.sh");
            std::process::exit(1);
        }
    };

    // Create database connection pool
    let db_pool = match create_connection_pool(&db_config).await {
        Ok(pool) => pool,
        Err(e) => {
            error!("Failed to create database connection pool: {}", e);
            error!("Connection string: {}", db_config.connection_string);
            error!("");
            error!("To fix this issue:");
            error!("1. If using Docker, run: ./scripts/setup-dev-db.sh");
            error!("2. Or start SQL Server container: docker compose up -d sqlserver");
            error!("3. Wait for SQL Server to be ready (about 30-60 seconds)");
            error!("4. Then try running the backend again: cargo run");
            std::process::exit(1);
        }
    };

    info!("Database connection pool established successfully");

    // Get server configuration from environment or use defaults
    let host = std::env::var("SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("SERVER_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);

    let bind_address = format!("{}:{}", host, port);
    info!("Server will bind to: {}", bind_address);

    // Generate a secure random key for session cookies
    let secret_key = Key::generate();

    // Start HTTP server
    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin("http://localhost:3000") // Frontend development server
            .allowed_methods(vec!["GET", "POST", "OPTIONS"]) // Add OPTIONS for preflight
            .allowed_headers(vec!["content-type", "accept", "origin", "x-requested-with"])
            .supports_credentials() // Required for session cookies
            .max_age(3600);

        let session_middleware = SessionMiddleware::builder(
            CookieSessionStore::default(),
            secret_key.clone(),
        )
        .cookie_secure(false) // Set to true in production with HTTPS
        .cookie_http_only(true)
        .session_lifecycle(
            PersistentSession::default()
                .session_ttl_extension_policy(
                    actix_session::config::TtlExtensionPolicy::OnStateChanges,
                ),
        )
        .build();

        App::new()
            .app_data(web::Data::new(db_pool.clone()))
            .wrap(cors)
            .wrap(session_middleware)
            .wrap(Logger::default())
            // Public endpoints
            .route("/health", web::get().to(health_check))
            .route("/shortened-url/{id}", web::get().to(redirect_url))
            // Authentication endpoints
            .service(
                web::scope("/auth")
                    .route("/register/begin", web::post().to(register_begin))
                    .route("/register/complete", web::post().to(register_complete))
                    .route("/login/begin", web::post().to(login_begin))
                    .route("/login/complete", web::post().to(login_complete))
                    .route("/logout", web::post().to(logout))
                    .route("/me", web::get().to(me)),
            )
            // Protected endpoints (no authentication middleware for now - TODO: Add later)
            .service(
                web::scope("/api")
                    .route("/shorten", web::post().to(shorten_url))
                    .route("/domains", web::post().to(add_domain))
                    .route("/domains", web::get().to(list_domains))
                    .route("/domains/{id}/verify", web::post().to(verify_domain)),
            )
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
        assert!(is_valid_url(
            "https://sub.example.com:443/path?a=1&b=2#section"
        ));

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

    #[tokio::test]
    async fn test_domain_validation() {
        // Test domain validation logic

        // Valid domains
        let (valid, msg, token) = DomainValidationService::validate_domain("example.com").await;
        assert!(
            !valid,
            "example.com should not be immediately verified: {}",
            msg
        ); // Changed to not verified
        assert!(
            token.is_some(),
            "Valid domain should have verification token"
        );

        let (valid, msg, token) = DomainValidationService::validate_domain("sub.example.com").await;
        assert!(
            !valid,
            "sub.example.com should not be immediately verified: {}",
            msg
        ); // Changed to not verified
        assert!(
            token.is_some(),
            "Valid domain should have verification token"
        );

        let (valid, msg, token) =
            DomainValidationService::validate_domain("test-domain.co.uk").await;
        assert!(
            !valid,
            "test-domain.co.uk should not be immediately verified: {}",
            msg
        ); // Changed to not verified
        assert!(
            token.is_some(),
            "Valid domain should have verification token"
        );

        // Invalid domains
        let (valid, _, token) = DomainValidationService::validate_domain("").await;
        assert!(!valid, "empty domain should be invalid");
        assert!(
            token.is_none(),
            "Invalid domain should not have verification token"
        );

        let (valid, _, token) = DomainValidationService::validate_domain("invalid..domain").await;
        assert!(!valid, "double dots should be invalid");
        assert!(
            token.is_none(),
            "Invalid domain should not have verification token"
        );

        let (valid, _, token) = DomainValidationService::validate_domain(".invalid.domain").await;
        assert!(!valid, "starting with dot should be invalid");
        assert!(
            token.is_none(),
            "Invalid domain should not have verification token"
        );

        let (valid, _, token) = DomainValidationService::validate_domain("invalid.domain.").await;
        assert!(!valid, "ending with dot should be invalid");
        assert!(
            token.is_none(),
            "Invalid domain should not have verification token"
        );

        // Test very long domain name
        let long_domain = "a".repeat(300) + ".com";
        let (valid, _, token) = DomainValidationService::validate_domain(&long_domain).await;
        assert!(!valid, "very long domain should be invalid");
        assert!(
            token.is_none(),
            "Invalid domain should not have verification token"
        );
    }
}
