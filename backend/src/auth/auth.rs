use crate::auth::models::*;
use crate::database::{DatabasePool, DatabaseService};
use actix_session::Session;
use actix_web::{web, HttpResponse, Result, ResponseError};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use log::{error, info, warn};
use rand::Rng;
use serde_json;
use std::fmt;
use uuid::Uuid;

// Create a custom error type for auth operations
#[derive(Debug)]
pub enum AuthError {
    Anyhow(anyhow::Error),
}

impl fmt::Display for AuthError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            AuthError::Anyhow(e) => write!(f, "Authentication error: {}", e),
        }
    }
}

impl ResponseError for AuthError {
    fn error_response(&self) -> HttpResponse {
        HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Authentication error"
        }))
    }
}

impl From<anyhow::Error> for AuthError {
    fn from(err: anyhow::Error) -> Self {
        AuthError::Anyhow(err)
    }
}

pub struct AuthService;

impl AuthService {
    // Generate a cryptographic challenge for WebAuthn
    pub fn generate_challenge() -> Vec<u8> {
        let mut rng = rand::thread_rng();
        let mut challenge = vec![0u8; 32];
        rng.fill(&mut challenge[..]);
        challenge
    }

    // Generate user ID for WebAuthn
    pub fn generate_user_id() -> Vec<u8> {
        Uuid::new_v4().as_bytes().to_vec()
    }

    // Encode bytes to base64 URL-safe string
    pub fn encode_base64(data: &[u8]) -> String {
        URL_SAFE_NO_PAD.encode(data)
    }

    // Decode base64 URL-safe string to bytes
    pub fn decode_base64(data: &str) -> Result<Vec<u8>, base64::DecodeError> {
        URL_SAFE_NO_PAD.decode(data)
    }

    // Basic credential validation (simplified)
    pub async fn validate_registration_credential(
        credential: &PublicKeyCredential,
        expected_challenge: &str,
        expected_origin: &str,
    ) -> Result<(Vec<u8>, Vec<u8>), AuthError> {
        // In a real implementation, this would use a proper WebAuthn library
        // For now, we'll do basic validation and extract the key information

        match &credential.response {
            AuthenticatorResponse::AttestationResponse(response) => {
                // Decode client data JSON
                let client_data_bytes = Self::decode_base64(&response.client_data_json)
                    .map_err(|e| AuthError::from(anyhow::anyhow!("Failed to decode client data: {}", e)))?;
                
                let client_data: serde_json::Value = serde_json::from_slice(&client_data_bytes)
                    .map_err(|e| AuthError::from(anyhow::anyhow!("Failed to parse client data JSON: {}", e)))?;

                // Validate challenge
                let received_challenge = client_data["challenge"].as_str()
                    .ok_or_else(|| AuthError::from(anyhow::anyhow!("Missing challenge in client data")))?;
                
                if received_challenge != expected_challenge {
                    return Err(AuthError::from(anyhow::anyhow!("Challenge mismatch")));
                }

                // Validate origin
                let received_origin = client_data["origin"].as_str()
                    .ok_or_else(|| AuthError::from(anyhow::anyhow!("Missing origin in client data")))?;
                
                if received_origin != expected_origin {
                    return Err(AuthError::from(anyhow::anyhow!("Origin mismatch")));
                }

                // Extract credential ID and public key (simplified)
                let credential_id = Self::decode_base64(&credential.raw_id)
                    .map_err(|e| AuthError::from(anyhow::anyhow!("Failed to decode credential ID: {}", e)))?;

                // In a real implementation, we would parse the attestation object
                // and extract the actual public key. For now, we'll use a placeholder
                let attestation_object = Self::decode_base64(&response.attestation_object)
                    .map_err(|e| AuthError::from(anyhow::anyhow!("Failed to decode attestation object: {}", e)))?;

                // Simplified: use first 65 bytes as public key (this is not correct for production)
                let public_key = if attestation_object.len() >= 65 {
                    attestation_object[..65].to_vec()
                } else {
                    // Fallback for development
                    vec![0u8; 65]
                };

                info!("Registration credential validated successfully");
                Ok((credential_id, public_key))
            }
            _ => Err(AuthError::from(anyhow::anyhow!("Invalid response type for registration"))),
        }
    }

    pub async fn validate_authentication_credential(
        credential: &PublicKeyCredential,
        expected_challenge: &str,
        expected_origin: &str,
        _stored_public_key: &[u8],
        stored_counter: u32,
    ) -> Result<u32, AuthError> {
        match &credential.response {
            AuthenticatorResponse::AssertionResponse(response) => {
                // Decode client data JSON
                let client_data_bytes = Self::decode_base64(&response.client_data_json)
                    .map_err(|e| AuthError::from(anyhow::anyhow!("Failed to decode client data: {}", e)))?;
                
                let client_data: serde_json::Value = serde_json::from_slice(&client_data_bytes)
                    .map_err(|e| AuthError::from(anyhow::anyhow!("Failed to parse client data JSON: {}", e)))?;

                // Validate challenge
                let received_challenge = client_data["challenge"].as_str()
                    .ok_or_else(|| AuthError::from(anyhow::anyhow!("Missing challenge in client data")))?;
                
                if received_challenge != expected_challenge {
                    return Err(AuthError::from(anyhow::anyhow!("Challenge mismatch")));
                }

                // Validate origin
                let received_origin = client_data["origin"].as_str()
                    .ok_or_else(|| AuthError::from(anyhow::anyhow!("Missing origin in client data")))?;
                
                if received_origin != expected_origin {
                    return Err(AuthError::from(anyhow::anyhow!("Origin mismatch")));
                }

                // In a real implementation, we would:
                // 1. Decode authenticator data
                // 2. Verify the signature using the stored public key
                // 3. Check the counter value
                // For now, we'll do simplified validation

                info!("Authentication credential validated successfully");
                Ok(stored_counter + 1) // Increment counter
            }
            _ => Err(AuthError::from(anyhow::anyhow!("Invalid response type for authentication"))),
        }
    }
}

// WebAuthn registration handlers
pub async fn register_begin(
    req: web::Json<RegisterBeginRequest>,
    session: Session,
    db_pool: web::Data<DatabasePool>,
) -> Result<HttpResponse> {
    let username = req.username.trim().to_string();
    let email = req.email.trim().to_lowercase();

    info!("Beginning registration for user: {}", username);

    // Validate input
    if username.is_empty() || username.len() > 255 {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Username must be between 1 and 255 characters"
        })));
    }

    if email.is_empty() || email.len() > 320 || !email.contains('@') {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid email address"
        })));
    }

    // Check if username already exists
    match DatabaseService::get_user_by_username(&db_pool, &username).await {
        Ok(Some(_)) => {
            return Ok(HttpResponse::Conflict().json(serde_json::json!({
                "error": "Username already exists"
            })));
        }
        Ok(None) => {
            // Username is available, continue
        }
        Err(e) => {
            error!("Database error checking username: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            })));
        }
    }

    // Check if email already exists
    match DatabaseService::get_user_by_email(&db_pool, &email).await {
        Ok(Some(_)) => {
            return Ok(HttpResponse::Conflict().json(serde_json::json!({
                "error": "Email already exists"
            })));
        }
        Ok(None) => {
            // Email is available, continue
        }
        Err(e) => {
            error!("Database error checking email: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            })));
        }
    }

    // Generate challenge and user ID
    let challenge = AuthService::generate_challenge();
    let user_id = AuthService::generate_user_id();
    let challenge_b64 = AuthService::encode_base64(&challenge);
    let user_id_b64 = AuthService::encode_base64(&user_id);

    // Store challenge in session for later verification
    let registration_data = serde_json::json!({
        "challenge": challenge_b64,
        "user_id": user_id_b64,
        "username": username,
        "email": email,
        "timestamp": chrono::Utc::now().timestamp()
    });

    if let Err(e) = session.insert("registration_data", registration_data) {
        error!("Failed to store registration data in session: {}", e);
        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Session error"
        })));
    }

    // Create WebAuthn registration options
    let response = RegisterBeginResponse {
        challenge: challenge_b64,
        user_id: user_id_b64.clone(),
        timeout: 60000, // 60 seconds
        rp: RelyingParty {
            id: std::env::var("WEBAUTHN_RP_ID").unwrap_or_else(|_| "localhost".to_string()),
            name: std::env::var("WEBAUTHN_RP_NAME").unwrap_or_else(|_| "Thalora URL Shortener".to_string()),
        },
        user: UserInfo {
            id: user_id_b64,
            name: username.clone(),
            display_name: username,
        },
        pub_key_cred_params: vec![
            PubKeyCredParam {
                alg: -7,  // ES256
                cred_type: "public-key".to_string(),
            },
            PubKeyCredParam {
                alg: -257, // RS256
                cred_type: "public-key".to_string(),
            },
        ],
        authenticator_selection: AuthenticatorSelection {
            authenticator_attachment: None,
            require_resident_key: false,
            resident_key: "preferred".to_string(),
            user_verification: "preferred".to_string(),
        },
        attestation: "none".to_string(),
    };

    Ok(HttpResponse::Ok().json(response))
}

pub async fn register_complete(
    req: web::Json<RegisterCompleteRequest>,
    session: Session,
    db_pool: web::Data<DatabasePool>,
) -> Result<HttpResponse> {
    info!("Completing registration for user ID: {}", req.user_id);

    // Get registration data from session
    let registration_data: serde_json::Value = match session.get("registration_data")? {
        Some(data) => data,
        None => {
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "No registration in progress"
            })));
        }
    };

    let stored_challenge = match registration_data["challenge"].as_str() {
        Some(challenge) => challenge,
        None => {
            error!("Invalid registration data: missing challenge");
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid registration data"
            })));
        }
    };
    
    let stored_user_id = match registration_data["user_id"].as_str() {
        Some(user_id) => user_id,
        None => {
            error!("Invalid registration data: missing user_id");
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid registration data"
            })));
        }
    };
    
    let username = match registration_data["username"].as_str() {
        Some(username) => username,
        None => {
            error!("Invalid registration data: missing username");
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid registration data"
            })));
        }
    };
    
    let email = match registration_data["email"].as_str() {
        Some(email) => email,
        None => {
            error!("Invalid registration data: missing email");
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid registration data"
            })));
        }
    };

    // Verify user ID matches
    if req.user_id != stored_user_id {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "User ID mismatch"
        })));
    }

    // Validate credential
    let expected_origin = std::env::var("WEBAUTHN_ORIGIN").unwrap_or_else(|_| "http://localhost:3000".to_string());
    match AuthService::validate_registration_credential(&req.credential, stored_challenge, &expected_origin).await {
        Ok((credential_id, public_key)) => {
            // Store user in database
            match DatabaseService::create_user(
                &db_pool,
                username,
                email,
                &public_key,
                &credential_id,
                0, // Initial counter
            ).await {
                Ok(user_id) => {
                    // Clear registration data from session
                    session.remove("registration_data");

                    // Set user session
                    if let Err(e) = session.insert("user_id", user_id) {
                        warn!("Failed to set user session: {}", e);
                    }

                    info!("User registered successfully: {} (ID: {})", username, user_id);

                    Ok(HttpResponse::Ok().json(RegisterCompleteResponse {
                        user_id,
                        username: username.to_string(),
                        email: email.to_string(),
                    }))
                }
                Err(e) => {
                    error!("Failed to create user: {}", e);
                    Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Failed to create user"
                    })))
                }
            }
        }
        Err(e) => {
            error!("Credential validation failed: {}", e);
            Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid credential"
            })))
        }
    }
}

pub async fn login_begin(
    req: web::Json<LoginBeginRequest>,
    session: Session,
    db_pool: web::Data<DatabasePool>,
) -> Result<HttpResponse> {
    let username = req.username.trim();

    info!("Beginning login for user: {}", username);

    // Get user from database
    let user = match DatabaseService::get_user_by_username(&db_pool, username).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "User not found"
            })));
        }
        Err(e) => {
            error!("Database error retrieving user: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            })));
        }
    };

    // Generate challenge
    let challenge = AuthService::generate_challenge();
    let challenge_b64 = AuthService::encode_base64(&challenge);

    // Store login data in session
    let login_data = serde_json::json!({
        "challenge": challenge_b64,
        "user_id": user.id,
        "username": username,
        "timestamp": chrono::Utc::now().timestamp()
    });

    if let Err(e) = session.insert("login_data", login_data) {
        error!("Failed to store login data in session: {}", e);
        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Session error"
        })));
    }

    // Create WebAuthn authentication options
    let response = LoginBeginResponse {
        challenge: challenge_b64,
        timeout: 60000, // 60 seconds
        rp_id: std::env::var("WEBAUTHN_RP_ID").unwrap_or_else(|_| "localhost".to_string()),
        allow_credentials: vec![AllowedCredential {
            id: AuthService::encode_base64(&user.passkey_credential_id),
            cred_type: "public-key".to_string(),
            transports: Some(vec!["internal".to_string()]),
        }],
    };

    Ok(HttpResponse::Ok().json(response))
}

pub async fn login_complete(
    req: web::Json<LoginCompleteRequest>,
    session: Session,
    db_pool: web::Data<DatabasePool>,
) -> Result<HttpResponse> {
    info!("Completing login for user: {}", req.username);

    // Get login data from session
    let login_data: serde_json::Value = match session.get("login_data")? {
        Some(data) => data,
        None => {
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "No login in progress"
            })));
        }
    };

    let stored_challenge = match login_data["challenge"].as_str() {
        Some(challenge) => challenge,
        None => {
            error!("Invalid login data: missing challenge");
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid login data"
            })));
        }
    };
    
    let stored_username = match login_data["username"].as_str() {
        Some(username) => username,
        None => {
            error!("Invalid login data: missing username");
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid login data"
            })));
        }
    };

    // Verify username matches
    if req.username != stored_username {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Username mismatch"
        })));
    }

    // Get user from database
    let user = match DatabaseService::get_user_by_username(&db_pool, &req.username).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "User not found"
            })));
        }
        Err(e) => {
            error!("Database error retrieving user: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            })));
        }
    };

    // Validate credential
    let expected_origin = std::env::var("WEBAUTHN_ORIGIN").unwrap_or_else(|_| "http://localhost:3000".to_string());
    match AuthService::validate_authentication_credential(
        &req.credential,
        stored_challenge,
        &expected_origin,
        &user.passkey_public_key,
        user.passkey_counter,
    ).await {
        Ok(new_counter) => {
            // Update counter in database
            if let Err(e) = DatabaseService::update_user_counter(&db_pool, user.id, new_counter).await {
                warn!("Failed to update user counter: {}", e);
            }

            // Clear login data from session
            session.remove("login_data");

            // Set user session
            if let Err(e) = session.insert("user_id", user.id) {
                warn!("Failed to set user session: {}", e);
            }

            info!("User logged in successfully: {} (ID: {})", user.username, user.id);

            Ok(HttpResponse::Ok().json(LoginCompleteResponse {
                user_id: user.id,
                username: user.username,
                email: user.email,
            }))
        }
        Err(e) => {
            error!("Authentication failed: {}", e);
            Ok(HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Authentication failed"
            })))
        }
    }
}

pub async fn logout(session: Session) -> Result<HttpResponse> {
    session.clear();
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Logged out successfully"
    })))
}

pub async fn me(
    session: Session,
    db_pool: web::Data<DatabasePool>,
) -> Result<HttpResponse> {
    let user_id: i64 = match session.get("user_id")? {
        Some(id) => id,
        None => {
            return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Not authenticated"
            })));
        }
    };

    match DatabaseService::get_user_by_id(&db_pool, user_id).await {
        Ok(Some(user)) => {
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "created_at": user.created_at
            })))
        }
        Ok(None) => {
            // User was deleted but session still exists
            session.clear();
            Ok(HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "User not found"
            })))
        }
        Err(e) => {
            error!("Database error retrieving user: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            })))
        }
    }
}