// Authentication service for WebAuthn (Passkey) authentication
import { API_BASE_URL } from './api';

export interface RegisterBeginRequest {
  username: string;
  email: string;
}

export interface RegisterBeginResponse {
  challenge: string;
  user_id: string;
  timeout: number;
  rp: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    name: string;
    display_name: string;
  };
  pub_key_cred_params: Array<{
    alg: number;
    type: string;
  }>;
  authenticator_selection: {
    authenticator_attachment?: string;
    require_resident_key: boolean;
    resident_key: string;
    user_verification: string;
  };
  attestation: string;
}

export interface RegisterCompleteRequest {
  user_id: string;
  credential: {
    id: string;
    raw_id: string;
    type: string;
    response: {
      client_data_json: string;
      attestation_object: string;
    };
  };
}

export interface RegisterCompleteResponse {
  user_id: number;
  username: string;
  email: string;
}

export interface LoginBeginRequest {
  username: string;
}

export interface LoginBeginResponse {
  challenge: string;
  timeout: number;
  rp_id: string;
  allow_credentials: Array<{
    id: string;
    type: string;
    transports?: string[];
  }>;
}

export interface LoginCompleteRequest {
  username: string;
  credential: {
    id: string;
    raw_id: string;
    type: string;
    response: {
      client_data_json: string;
      authenticator_data: string;
      signature: string;
      user_handle?: string;
    };
  };
}

export interface LoginCompleteResponse {
  user_id: number;
  username: string;
  email: string;
}

export interface UserInfo {
  user_id: number;
  username: string;
  email: string;
  created_at: string;
}

// Helper function to convert array buffer to base64 URL-safe string
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Helper function to convert base64 URL-safe string to array buffer
function base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
  // Add padding if needed
  const padding = '===='.slice(0, (4 - (base64Url.length % 4)) % 4);
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/') + padding;
  
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  return bytes.buffer;
}

// Check if WebAuthn is supported
export function isWebAuthnSupported(): boolean {
  return !!(window.navigator && navigator.credentials && navigator.credentials.create);
}

// Begin registration process
export async function beginRegistration(username: string, email: string): Promise<RegisterBeginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/register/begin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ username, email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Registration failed');
  }

  return response.json();
}

// Complete registration process
export async function completeRegistration(
  registrationOptions: RegisterBeginResponse
): Promise<RegisterCompleteResponse> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  // Convert challenge and user ID to ArrayBuffer
  const challenge = base64UrlToArrayBuffer(registrationOptions.challenge);
  const userId = base64UrlToArrayBuffer(registrationOptions.user_id);

  // Create credential options for WebAuthn
  const publicKeyCredentialCreationOptions: CredentialCreationOptions = {
    publicKey: {
      challenge,
      rp: {
        name: registrationOptions.rp.name,
        id: registrationOptions.rp.id,
      },
      user: {
        id: userId,
        name: registrationOptions.user.name,
        displayName: registrationOptions.user.display_name,
      },
      pubKeyCredParams: registrationOptions.pub_key_cred_params.map(param => ({
        type: 'public-key',
        alg: param.alg,
      })),
      authenticatorSelection: {
        authenticatorAttachment: registrationOptions.authenticator_selection.authenticator_attachment as AuthenticatorAttachment | undefined,
        requireResidentKey: registrationOptions.authenticator_selection.require_resident_key,
        residentKey: registrationOptions.authenticator_selection.resident_key as ResidentKeyRequirement,
        userVerification: registrationOptions.authenticator_selection.user_verification as UserVerificationRequirement,
      },
      timeout: registrationOptions.timeout,
      attestation: registrationOptions.attestation as AttestationConveyancePreference,
    },
  };

  // Create credential using WebAuthn API
  const credential = await navigator.credentials.create(publicKeyCredentialCreationOptions) as PublicKeyCredential;

  if (!credential || !credential.response) {
    throw new Error('Failed to create credential');
  }

  const response = credential.response as AuthenticatorAttestationResponse;

  // Prepare completion request
  const completionRequest: RegisterCompleteRequest = {
    user_id: registrationOptions.user_id,
    credential: {
      id: credential.id,
      raw_id: arrayBufferToBase64Url(credential.rawId),
      type: credential.type,
      response: {
        client_data_json: arrayBufferToBase64Url(response.clientDataJSON),
        attestation_object: arrayBufferToBase64Url(response.attestationObject),
      },
    },
  };

  // Send completion request
  const completionResponse = await fetch(`${API_BASE_URL}/auth/register/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(completionRequest),
  });

  if (!completionResponse.ok) {
    const error = await completionResponse.json();
    throw new Error(error.error || 'Registration completion failed');
  }

  return completionResponse.json();
}

// Begin login process
export async function beginLogin(username: string): Promise<LoginBeginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login/begin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ username }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  return response.json();
}

// Complete login process
export async function completeLogin(
  username: string,
  loginOptions: LoginBeginResponse
): Promise<LoginCompleteResponse> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  // Convert challenge to ArrayBuffer
  const challenge = base64UrlToArrayBuffer(loginOptions.challenge);

  // Create assertion options for WebAuthn
  const publicKeyCredentialRequestOptions: CredentialRequestOptions = {
    publicKey: {
      challenge,
      rpId: loginOptions.rp_id,
      allowCredentials: loginOptions.allow_credentials.map(cred => ({
        type: 'public-key',
        id: base64UrlToArrayBuffer(cred.id),
        transports: cred.transports as AuthenticatorTransport[] | undefined,
      })),
      timeout: loginOptions.timeout,
      userVerification: 'preferred',
    },
  };

  // Get assertion using WebAuthn API
  const assertion = await navigator.credentials.get(publicKeyCredentialRequestOptions) as PublicKeyCredential;

  if (!assertion || !assertion.response) {
    throw new Error('Failed to get assertion');
  }

  const response = assertion.response as AuthenticatorAssertionResponse;

  // Prepare completion request
  const completionRequest: LoginCompleteRequest = {
    username,
    credential: {
      id: assertion.id,
      raw_id: arrayBufferToBase64Url(assertion.rawId),
      type: assertion.type,
      response: {
        client_data_json: arrayBufferToBase64Url(response.clientDataJSON),
        authenticator_data: arrayBufferToBase64Url(response.authenticatorData),
        signature: arrayBufferToBase64Url(response.signature),
        user_handle: response.userHandle ? arrayBufferToBase64Url(response.userHandle) : undefined,
      },
    },
  };

  // Send completion request
  const completionResponse = await fetch(`${API_BASE_URL}/auth/login/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(completionRequest),
  });

  if (!completionResponse.ok) {
    const error = await completionResponse.json();
    throw new Error(error.error || 'Login completion failed');
  }

  return completionResponse.json();
}

// Get current user info
export async function getCurrentUser(): Promise<UserInfo> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get user info');
  }

  return response.json();
}

// Logout
export async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Logout failed');
  }
}

// Check if test mode is enabled
export async function isTestMode(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/test-mode`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.test_mode === true;
  } catch (error) {
    console.error('Failed to check test mode:', error);
    return false;
  }
}

// Test mode registration - bypasses WebAuthn
async function testModeRegister(username: string, email: string): Promise<RegisterCompleteResponse> {
  // Start normal registration flow
  const beginResponse = await beginRegistration(username, email);
  
  // Create fake credential for test mode
  const fakeCredential = {
    id: `test-credential-${username}`,
    raw_id: btoa(`test-credential-${username}`),
    type: 'public-key',
    response: {
      client_data_json: btoa(JSON.stringify({
        type: 'webauthn.create',
        challenge: beginResponse.challenge,
        origin: window.location.origin,
      })),
      attestation_object: btoa('fake-attestation-object'),
    },
  };

  // Complete registration with fake credential
  const completionRequest = {
    user_id: beginResponse.user_id,
    credential: fakeCredential,
  };

  const completionResponse = await fetch(`${API_BASE_URL}/auth/register/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(completionRequest),
  });

  if (!completionResponse.ok) {
    const error = await completionResponse.json();
    throw new Error(error.error || 'Registration completion failed');
  }

  return completionResponse.json();
}

// Test mode login - bypasses WebAuthn
async function testModeLogin(username: string): Promise<LoginCompleteResponse> {
  // Start normal login flow
  const beginResponse = await beginLogin(username);

  // Create fake assertion for test mode
  const fakeCredential = {
    id: `test-credential-${username}`,
    raw_id: btoa(`test-credential-${username}`),
    type: 'public-key',
    response: {
      client_data_json: btoa(JSON.stringify({
        type: 'webauthn.get',
        challenge: beginResponse.challenge,
        origin: window.location.origin,
      })),
      authenticator_data: btoa('fake-authenticator-data'),
      signature: btoa('fake-signature'),
    },
  };

  // Complete login with fake credential
  const completionRequest = {
    username: username,
    credential: fakeCredential,
  };

  const completionResponse = await fetch(`${API_BASE_URL}/auth/login/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(completionRequest),
  });

  if (!completionResponse.ok) {
    const error = await completionResponse.json();
    throw new Error(error.error || 'Login completion failed');
  }

  return completionResponse.json();
}

// Register with passkey (or test mode)
export async function registerWithPasskey(username: string, email: string): Promise<RegisterCompleteResponse> {
  const testMode = await isTestMode();
  
  if (testMode) {
    console.log('Test mode detected - using simplified registration');
    return await testModeRegister(username, email);
  } else {
    const beginResponse = await beginRegistration(username, email);
    return await completeRegistration(beginResponse);
  }
}

// Login with passkey (or test mode)
export async function loginWithPasskey(username: string): Promise<LoginCompleteResponse> {
  const testMode = await isTestMode();
  
  if (testMode) {
    console.log('Test mode detected - using simplified login');
    return await testModeLogin(username);
  } else {
    const beginResponse = await beginLogin(username);
    return await completeLogin(username, beginResponse);
  }
}