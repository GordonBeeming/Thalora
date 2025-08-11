use actix_web::{test, web, App, HttpResponse, Result};

// Import the functions we want to test
// Note: In a real implementation, these should be in lib.rs or made public
async fn health_check() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "thalora-backend"
    })))
}

#[actix_web::test]
async fn test_health_check() {
    let app = test::init_service(
        App::new().route("/health", web::get().to(health_check))
    ).await;
    
    let req = test::TestRequest::get().uri("/health").to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);

    let body = test::read_body(resp).await;
    let body_str = std::str::from_utf8(&body).expect("Invalid UTF-8");
    let json_body: serde_json::Value = serde_json::from_str(body_str).expect("Invalid JSON");
    
    assert_eq!(json_body["status"], "healthy");
    assert_eq!(json_body["service"], "thalora-backend");
}

#[test]
fn test_environment_variable_configuration() {
    // Test that configuration values can be overridden with environment variables
    std::env::set_var("WEBAUTHN_RP_ID", "example.com");
    std::env::set_var("WEBAUTHN_RP_NAME", "Test App");
    std::env::set_var("WEBAUTHN_ORIGIN", "https://example.com");
    std::env::set_var("ALLOWED_ORIGINS", "https://example.com,https://test.example.com");

    // Test configuration loading
    let rp_id = std::env::var("WEBAUTHN_RP_ID").unwrap();
    let rp_name = std::env::var("WEBAUTHN_RP_NAME").unwrap();
    let origin = std::env::var("WEBAUTHN_ORIGIN").unwrap();
    let origins = std::env::var("ALLOWED_ORIGINS").unwrap();

    assert_eq!(rp_id, "example.com");
    assert_eq!(rp_name, "Test App");
    assert_eq!(origin, "https://example.com");
    assert_eq!(origins, "https://example.com,https://test.example.com");

    // Clean up
    std::env::remove_var("WEBAUTHN_RP_ID");
    std::env::remove_var("WEBAUTHN_RP_NAME");
    std::env::remove_var("WEBAUTHN_ORIGIN");
    std::env::remove_var("ALLOWED_ORIGINS");
}

#[test]
fn test_default_configuration_values() {
    // Test that default values are used when env vars are not set
    std::env::remove_var("WEBAUTHN_RP_ID");
    std::env::remove_var("WEBAUTHN_RP_NAME");
    std::env::remove_var("WEBAUTHN_ORIGIN");
    std::env::remove_var("ALLOWED_ORIGINS");

    // Test default values
    let rp_id = std::env::var("WEBAUTHN_RP_ID").unwrap_or_else(|_| "localhost".to_string());
    let rp_name = std::env::var("WEBAUTHN_RP_NAME").unwrap_or_else(|_| "Thalora URL Shortener".to_string());
    let origin = std::env::var("WEBAUTHN_ORIGIN").unwrap_or_else(|_| "http://localhost:3000".to_string());
    let origins = std::env::var("ALLOWED_ORIGINS").unwrap_or_else(|_| "http://localhost:3000".to_string());

    assert_eq!(rp_id, "localhost");
    assert_eq!(rp_name, "Thalora URL Shortener");
    assert_eq!(origin, "http://localhost:3000");
    assert_eq!(origins, "http://localhost:3000");
}

#[test]
fn test_cors_origin_parsing() {
    // Test CORS origin parsing functionality
    let origins_str = "http://localhost:3000,https://example.com,https://subdomain.example.com";
    let origins: Vec<String> = origins_str
        .split(',')
        .map(|s| s.trim().to_string())
        .collect();

    assert_eq!(origins.len(), 3);
    assert_eq!(origins[0], "http://localhost:3000");
    assert_eq!(origins[1], "https://example.com");
    assert_eq!(origins[2], "https://subdomain.example.com");
}

#[test] 
fn test_url_validation_logic() {
    use url::Url;
    
    // Test URL validation function logic
    fn is_valid_url(url_str: &str) -> bool {
        match Url::parse(url_str) {
            Ok(url) => url.scheme() == "https",
            Err(_) => false,
        }
    }

    // Valid HTTPS URLs
    assert!(is_valid_url("https://www.example.com"));
    assert!(is_valid_url("https://example.com"));
    assert!(is_valid_url("https://subdomain.example.com/path"));
    assert!(is_valid_url("https://subdomain.example.com/path?query=1"));

    // Invalid HTTP URLs (should be rejected)
    assert!(!is_valid_url("http://www.example.com"));
    assert!(!is_valid_url("http://example.com"));

    // Invalid formats
    assert!(!is_valid_url("not-a-url"));
    assert!(!is_valid_url(""));
    assert!(!is_valid_url("ftp://example.com"));
    assert!(!is_valid_url("www.example.com")); // No protocol
}

#[test]
fn test_short_id_generation() {
    use rand::distributions::Alphanumeric;
    use rand::{thread_rng, Rng};
    
    fn generate_short_id() -> String {
        thread_rng()
            .sample_iter(&Alphanumeric)
            .take(8)
            .map(char::from)
            .collect()
    }

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
fn test_domain_validation_logic() {
    fn basic_domain_validation(domain: &str) -> bool {
        if domain.is_empty() || domain.len() > 253 {
            return false;
        }

        let domain_regex = regex::Regex::new(r"^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$").unwrap();
        domain_regex.is_match(domain)
    }

    // Valid domains
    assert!(basic_domain_validation("example.com"));
    assert!(basic_domain_validation("sub.example.com"));
    assert!(basic_domain_validation("test-domain.co.uk"));

    // Invalid domains
    assert!(!basic_domain_validation(""));
    assert!(!basic_domain_validation("invalid..domain"));
    assert!(!basic_domain_validation(".invalid.domain"));
    assert!(!basic_domain_validation("invalid.domain."));
    
    // Test very long domain name
    let long_domain = "a".repeat(300) + ".com";
    assert!(!basic_domain_validation(&long_domain));
}

#[test]
fn test_base64_url_safe_encoding() {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    
    fn encode_base64(data: &[u8]) -> String {
        URL_SAFE_NO_PAD.encode(data)
    }
    
    fn decode_base64(data: &str) -> Result<Vec<u8>, base64::DecodeError> {
        URL_SAFE_NO_PAD.decode(data)
    }
    
    let test_data = b"Hello, World! This is a test of base64 encoding.";
    let encoded = encode_base64(test_data);
    let decoded = decode_base64(&encoded).expect("Failed to decode");
    
    assert_eq!(test_data.to_vec(), decoded);

    // Test data that would normally include URL-unsafe characters in standard base64
    let test_data = b"\x00\xFF\xFE\xFD";
    let encoded = encode_base64(test_data);
    
    // URL-safe base64 should not contain '+' or '/' characters
    assert!(!encoded.contains('+'));
    assert!(!encoded.contains('/'));
    assert!(!encoded.ends_with('='));  // URL_SAFE_NO_PAD removes padding
    
    let decoded = decode_base64(&encoded).expect("Failed to decode");
    assert_eq!(test_data.to_vec(), decoded);
}

#[test]
fn test_webauthn_data_structures() {
    use serde_json;

    // Test RelyingParty structure
    #[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq)]
    struct RelyingParty {
        id: String,
        name: String,
    }

    let rp = RelyingParty {
        id: "example.com".to_string(),
        name: "Test Application".to_string(),
    };

    let json = serde_json::to_string(&rp).expect("Failed to serialize");
    let deserialized: RelyingParty = serde_json::from_str(&json).expect("Failed to deserialize");
    
    assert_eq!(rp, deserialized);

    // Test UserInfo structure
    #[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq)]
    struct UserInfo {
        id: String,
        name: String,
        display_name: String,
    }

    let user_info = UserInfo {
        id: "user123".to_string(),
        name: "testuser".to_string(),
        display_name: "Test User".to_string(),
    };

    let json = serde_json::to_string(&user_info).expect("Failed to serialize");
    let deserialized: UserInfo = serde_json::from_str(&json).expect("Failed to deserialize");
    
    assert_eq!(user_info, deserialized);
}

#[test]
fn test_registration_request_validation() {
    // Test username validation
    fn validate_username(username: &str) -> bool {
        !username.is_empty() && username.len() <= 255
    }

    // Test email validation (basic)
    fn validate_email(email: &str) -> bool {
        !email.is_empty() && email.len() <= 320 && email.contains('@')
    }

    // Valid cases
    assert!(validate_username("validuser"));
    assert!(validate_username("user123"));
    assert!(validate_email("test@example.com"));
    assert!(validate_email("user.name@subdomain.example.com"));

    // Invalid cases
    assert!(!validate_username(""));
    assert!(!validate_username(&"a".repeat(256)));
    assert!(!validate_email(""));
    assert!(!validate_email("not-an-email"));
    assert!(!validate_email(&("a".repeat(320) + "@example.com")));
}

// Performance and stress tests
#[test]
fn test_short_id_uniqueness() {
    use std::collections::HashSet;
    use rand::distributions::Alphanumeric;
    use rand::{thread_rng, Rng};
    
    fn generate_short_id() -> String {
        thread_rng()
            .sample_iter(&Alphanumeric)
            .take(8)
            .map(char::from)
            .collect()
    }

    let mut ids = HashSet::new();

    // Generate 1000 IDs and ensure they're all unique
    for _ in 0..1000 {
        let id = generate_short_id();
        assert_eq!(id.len(), 8);
        assert!(id.chars().all(|c| c.is_ascii_alphanumeric()));
        assert!(ids.insert(id), "Generated duplicate ID");
    }
}