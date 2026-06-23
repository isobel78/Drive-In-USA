<?php
// Admin credentials
// To generate a new password hash, run this in PHP:
//      echo password_hash('your_password_here', PASSWORD_BCRYPT);
// Then paste the result as ADMIN_PASSWORD_HASH below.

define('ADMIN_EMAIL', 'your-email@example.com'); // Replace with your actual admin email
define('ADMIN_PASSWORD_HASH', 'your_password_hash_here'); // Replace with your actual password hash

// Session config
define('SESSION_NAME', 'drivein_session');
define('SESSION_LIFETIME', 60 * 60 * 8); // 8 hours

function startSecureSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_name(SESSION_NAME);
        session_set_cookie_params([
            'lifetime' => SESSION_LIFETIME,
            'path'     => '/',
            'secure'   => isset($_SERVER['HTTPS']),
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        session_start();
    }
}

function setCorsHeaders(): void {
    // This header is a safety net only.
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = ['http://localhost:3000', 'http://localhost:5173'];
    if (in_array($origin, $allowed)) {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
    }
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function jsonResponse(mixed $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function jsonError(string $message, int $status = 400): void {
    jsonResponse(['error' => $message], $status);
}

function requireAdmin(): void {
    startSecureSession();
    if (empty($_SESSION['admin_logged_in'])) {
        jsonError('Unauthorized', 401);
    }
}
