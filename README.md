# Thalora

**Thalora** is a modern, secure, and customizable URL shortener designed for simplicity and performance. It allows users to shorten URLs and configure their own custom domains for links. Built with **React**, **Rust**, and **SQL Server**, Thalora focuses on providing an efficient, user-friendly experience with security features like **passkey-based authentication**.

## Features

- **Custom domain support**: Users can configure their own domains for shortened URLs.
- **Passwordless authentication**: Uses **passkeys** for secure and simple login.
- **Responsive UI**: Optimized for both desktop and mobile with a clean, modern design.
- **Fast and secure backend**: Powered by **Rust** for performance and scalability.
- **Simple error handling**: User-friendly design that displays helpful error messages.

## Tech Stack

- **Frontend**: React
- **Backend**: Rust (using Actix or Warp)
- **Database**: SQL Server
- **Authentication**: Passkey-based authentication (WebAuthn/FIDO2)
- **Containerization**: Docker

## Installation

### Prerequisites
- **Docker** and **Docker Compose** for containerization.
- **Rust** for backend development (if modifying backend code).
- **Node.js** and **npm** for frontend development (if modifying frontend code).

### Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/gordonbeeming/thalora.git
   cd thalora
