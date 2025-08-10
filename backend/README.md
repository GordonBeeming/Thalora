# Thalora Backend

This is the Rust backend for the Thalora URL Shortener application. It provides a REST API for URL shortening and redirection.

## Features

- **URL Shortening**: POST `/shorten` endpoint to create shortened URLs
- **URL Redirection**: GET `/shortened-url/:id` endpoint for redirecting to original URLs
- **URL Validation**: Validates input URLs to ensure they are well-formed HTTPS URLs
- **Error Handling**: Comprehensive error responses for invalid inputs
- **Logging**: Request logging and application logging for monitoring
- **In-Memory Storage**: Currently uses HashMap for URL storage (will be replaced with database in future)

## API Endpoints

### POST /shorten
Creates a shortened URL from a long URL.

**Request:**
```json
{
  "url": "https://www.example.com"
}
```

**Response:**
```json
{
  "short_url": "http://localhost:8080/shortened-url/abc123",
  "original_url": "https://www.example.com"
}
```

### GET /shortened-url/:id
Redirects to the original URL associated with the shortened URL ID.

**Response:** 302 redirect to the original URL

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "thalora-backend"
}
```

## Running the Backend

1. Make sure Rust is installed
2. Navigate to the backend directory
3. Run the server:

```bash
cargo run
```

The server will start on `http://127.0.0.1:8080`

For development with logging:
```bash
RUST_LOG=info cargo run
```

## Dependencies

- **actix-web**: Web framework
- **serde**: Serialization/deserialization
- **tokio**: Async runtime
- **env_logger**: Logging
- **url**: URL parsing and validation
- **uuid**: For generating unique identifiers
- **rand**: Random string generation

## Future Enhancements

- Database integration (SQL Server)
- User authentication with passkeys
- Custom domain support
- Analytics and usage tracking
- Rate limiting
- URL expiration