use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub email: String,
    pub passkey_public_key: Vec<u8>,
    pub passkey_credential_id: Vec<u8>,
    pub passkey_counter: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterBeginRequest {
    pub username: String,
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct RegisterBeginResponse {
    pub challenge: String,
    pub user_id: String,
    pub timeout: u32,
    pub rp: RelyingParty,
    pub user: UserInfo,
    pub pub_key_cred_params: Vec<PubKeyCredParam>,
    pub authenticator_selection: AuthenticatorSelection,
    pub attestation: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterCompleteRequest {
    pub user_id: String,
    pub credential: PublicKeyCredential,
}

#[derive(Debug, Serialize)]
pub struct RegisterCompleteResponse {
    pub user_id: i64,
    pub username: String,
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginBeginRequest {
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct LoginBeginResponse {
    pub challenge: String,
    pub timeout: u32,
    pub rp_id: String,
    pub allow_credentials: Vec<AllowedCredential>,
}

#[derive(Debug, Deserialize)]
pub struct LoginCompleteRequest {
    pub username: String,
    pub credential: PublicKeyCredential,
}

#[derive(Debug, Serialize)]
pub struct LoginCompleteResponse {
    pub user_id: i64,
    pub username: String,
    pub email: String,
}

// WebAuthn data structures
#[derive(Debug, Serialize)]
pub struct RelyingParty {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub id: String,
    pub name: String,
    pub display_name: String,
}

#[derive(Debug, Serialize)]
pub struct PubKeyCredParam {
    pub alg: i32,
    #[serde(rename = "type")]
    pub cred_type: String,
}

#[derive(Debug, Serialize)]
pub struct AuthenticatorSelection {
    pub authenticator_attachment: Option<String>,
    pub require_resident_key: bool,
    pub resident_key: String,
    pub user_verification: String,
}

#[derive(Debug, Serialize)]
pub struct AllowedCredential {
    pub id: String,
    #[serde(rename = "type")]
    pub cred_type: String,
    pub transports: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)] // Fields are used by webauthn library through deserialization
pub struct PublicKeyCredential {
    pub id: String,
    pub raw_id: String,
    #[serde(rename = "type")]
    pub cred_type: String,
    pub response: AuthenticatorResponse,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum AuthenticatorResponse {
    AttestationResponse(AuthenticatorAttestationResponse),
    AssertionResponse(AuthenticatorAssertionResponse),
}

#[derive(Debug, Deserialize)]
pub struct AuthenticatorAttestationResponse {
    pub client_data_json: String,
    pub attestation_object: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)] // Fields are used by webauthn library through deserialization
pub struct AuthenticatorAssertionResponse {
    pub client_data_json: String,
    pub authenticator_data: String,
    pub signature: String,
    pub user_handle: Option<String>,
}