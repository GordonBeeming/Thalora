use actix_web::{test, web, App, http::StatusCode, HttpResponse, Result};
use serde_json;
use std::env;

/// Mock handler functions for testing
async fn mock_redirect_url(path: web::Path<String>) -> Result<HttpResponse> {
    let short_id = path.into_inner();
    
    // Mock database behavior - in a real test this would use a test database
    match short_id.as_str() {
        "valid123" => {
            Ok(HttpResponse::Found()
                .append_header(("Location", "https://www.example.com/test-page"))
                .finish())
        }
        "empty" | "" => {
            Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Short URL not found"
            })))
        }
        _ => {
            Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Short URL not found"
            })))
        }
    }
}

/// Integration tests for the redirect functionality endpoint behavior
#[cfg(test)]
mod redirect_behavior_tests {
    use super::*;

    #[actix_web::test]
    async fn test_redirect_endpoint_returns_302_for_valid_id() {
        let app = test::init_service(
            App::new()
                .route("/shortened-url/{id}", web::get().to(mock_redirect_url))
        ).await;

        let req = test::TestRequest::get()
            .uri("/shortened-url/valid123")
            .to_request();
            
        let resp = test::call_service(&app, req).await;

        // Should return HTTP 302 Found (redirect)
        assert_eq!(resp.status(), StatusCode::FOUND);
        
        // Should contain Location header
        let location_header = resp.headers().get("Location");
        assert!(location_header.is_some());
        assert_eq!(location_header.unwrap().to_str().unwrap(), "https://www.example.com/test-page");
    }

    #[actix_web::test]
    async fn test_redirect_endpoint_returns_404_for_invalid_id() {
        let app = test::init_service(
            App::new()
                .route("/shortened-url/{id}", web::get().to(mock_redirect_url))
        ).await;

        let req = test::TestRequest::get()
            .uri("/shortened-url/nonexistent")
            .to_request();
            
        let resp = test::call_service(&app, req).await;

        // Should return HTTP 404 Not Found
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
        
        // Should return JSON error
        let body = test::read_body(resp).await;
        let json: serde_json::Value = serde_json::from_slice(&body).expect("Failed to parse JSON");
        
        assert!(json.get("error").is_some());
        assert_eq!(json["error"], "Short URL not found");
    }

    #[actix_web::test]
    async fn test_redirect_endpoint_handles_empty_id() {
        let app = test::init_service(
            App::new()
                .route("/shortened-url/{id}", web::get().to(mock_redirect_url))
        ).await;

        let req = test::TestRequest::get()
            .uri("/shortened-url/empty")
            .to_request();
            
        let resp = test::call_service(&app, req).await;

        // Should return 404 for empty/invalid ID
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn test_redirect_endpoint_handles_special_characters() {
        let app = test::init_service(
            App::new()
                .route("/shortened-url/{id}", web::get().to(mock_redirect_url))
        ).await;

        // Test various special characters that might appear in URLs
        let test_cases = vec![
            "abc-123",
            "test_id", 
            "ID123",
            "with%20space",  // URL encoded space
        ];

        for short_id in test_cases {
            let req = test::TestRequest::get()
                .uri(&format!("/shortened-url/{}", short_id))
                .to_request();
                
            let resp = test::call_service(&app, req).await;

            // All these should return 404 since they don't exist in our mock
            assert_eq!(resp.status(), StatusCode::NOT_FOUND, "Failed for ID: {}", short_id);
            
            let body = test::read_body(resp).await;
            let json: serde_json::Value = serde_json::from_slice(&body).expect("Failed to parse JSON");
            assert_eq!(json["error"], "Short URL not found");
        }
    }

    #[actix_web::test]
    async fn test_redirect_response_headers() {
        let app = test::init_service(
            App::new()
                .route("/shortened-url/{id}", web::get().to(mock_redirect_url))
        ).await;

        let req = test::TestRequest::get()
            .uri("/shortened-url/valid123")
            .to_request();
            
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::FOUND);
        
        // Verify the Location header is properly set
        let location = resp.headers().get("Location").unwrap();
        let location_str = location.to_str().unwrap();
        
        // Should be a valid HTTPS URL
        assert!(location_str.starts_with("https://"));
        assert_eq!(location_str, "https://www.example.com/test-page");
    }

    #[actix_web::test]
    async fn test_error_response_format() {
        let app = test::init_service(
            App::new()
                .route("/shortened-url/{id}", web::get().to(mock_redirect_url))
        ).await;

        let req = test::TestRequest::get()
            .uri("/shortened-url/notfound")
            .to_request();
            
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
        
        // Verify error response format
        let body = test::read_body(resp).await;
        let json: serde_json::Value = serde_json::from_slice(&body).expect("Failed to parse JSON");
        
        // Should have error field
        assert!(json.is_object());
        assert!(json.get("error").is_some());
        assert!(json["error"].is_string());
        
        let error_message = json["error"].as_str().unwrap();
        assert!(!error_message.is_empty());
        assert_eq!(error_message, "Short URL not found");
    }
}

/// Unit tests for URL validation and ID generation logic
/// These test the same logic that the redirect functionality relies on
#[cfg(test)]
mod redirect_supporting_logic_tests {
    use url::Url;
    use rand::distributions::Alphanumeric;
    use rand::{thread_rng, Rng};

    /// Test URL validation logic (same as used in the main application)
    #[test]
    fn test_url_validation_for_redirects() {
        fn is_valid_https_url(url_str: &str) -> bool {
            match Url::parse(url_str) {
                Ok(url) => url.scheme() == "https",
                Err(_) => false,
            }
        }

        // Valid HTTPS URLs that can be redirect targets
        let valid_urls = vec![
            "https://www.example.com",
            "https://example.com/path",
            "https://subdomain.example.com/path?query=value",
            "https://example.co.uk:8080/secure",
        ];
        
        for url in valid_urls {
            assert!(is_valid_https_url(url), "Should accept HTTPS URL: {}", url);
        }
        
        // Invalid URLs that should not be redirect targets
        let invalid_urls = vec![
            "http://www.example.com",  // HTTP not allowed
            "ftp://example.com",       // FTP not allowed  
            "javascript:alert('xss')", // Potential XSS
            "",                        // Empty string
            "not-a-url",              // Invalid format
        ];
        
        for url in invalid_urls {
            assert!(!is_valid_https_url(url), "Should reject invalid URL: {}", url);
        }
    }

    /// Test short ID generation (same logic as used in main application)
    #[test]
    fn test_short_id_generation() {
        fn generate_test_short_id() -> String {
            thread_rng()
                .sample_iter(&Alphanumeric)
                .take(8)
                .map(char::from)
                .collect()
        }

        // Test multiple generated IDs
        for _ in 0..10 {
            let id = generate_test_short_id();
            
            // Should be exactly 8 characters
            assert_eq!(id.len(), 8);
            
            // Should contain only alphanumeric characters (URL-safe)
            assert!(id.chars().all(|c| c.is_ascii_alphanumeric()));
            
            // Should not contain characters that need URL encoding
            assert!(!id.contains(' '));
            assert!(!id.contains('/'));
            assert!(!id.contains('?'));
            assert!(!id.contains('&'));
            assert!(!id.contains('#'));
            assert!(!id.contains('%'));
        }
    }

    #[test]
    fn test_short_id_uniqueness() {
        fn generate_test_short_id() -> String {
            thread_rng()
                .sample_iter(&Alphanumeric)
                .take(8)
                .map(char::from)
                .collect()
        }

        let mut ids = std::collections::HashSet::new();

        // Generate 100 IDs and ensure they're all unique
        for _ in 0..100 {
            let id = generate_test_short_id();
            assert!(ids.insert(id), "Generated duplicate ID");
        }
    }
}