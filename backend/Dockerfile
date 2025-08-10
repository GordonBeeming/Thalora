# Build stage
FROM rust:1.75 as builder

WORKDIR /app
COPY . .
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the built binary
COPY --from=builder /app/target/release/thalora-backend /app/thalora-backend

# Create a non-root user
RUN useradd -r -s /bin/false thalora
USER thalora

EXPOSE 8080

CMD ["./thalora-backend"]