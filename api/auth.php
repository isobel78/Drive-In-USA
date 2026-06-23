<?php
require_once __DIR__ . '/config.php';

setCorsHeaders();
header('Content-Type: application/json');

startSecureSession();

$method = $_SERVER['REQUEST_METHOD'];
$path   = trim($_SERVER['PATH_INFO'] ?? '', '/');  // e.g. "login", "logout", "check"

// GET /api/auth.php/check — returns current session state
if ($method === 'GET') {
    if (!empty($_SESSION['admin_logged_in'])) {
        jsonResponse([
            'loggedIn' => true,
            'email'    => $_SESSION['admin_email'] ?? '',
        ]);
    } else {
        jsonResponse(['loggedIn' => false]);
    }
}

// POST /api/auth.php — body: { "action": "login"|"logout", "email": "", "password": "" }
if ($method === 'POST') {
    $data   = json_decode(file_get_contents('php://input'), true);
    $action = $data['action'] ?? '';

    if ($action === 'login') {
        $email    = trim($data['email'] ?? '');
        $password = $data['password'] ?? '';

        if ($email !== ADMIN_EMAIL) {
            jsonError('Invalid credentials', 401);
        }
        if (!password_verify($password, ADMIN_PASSWORD_HASH)) {
            jsonError('Invalid credentials', 401);
        }

        // Regenerate session ID on privilege escalation
        session_regenerate_id(true);
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['admin_email']     = $email;

        jsonResponse(['loggedIn' => true, 'email' => $email]);
    }

    if ($action === 'logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params['path'], $params['domain'],
                $params['secure'], $params['httponly']
            );
        }
        session_destroy();
        jsonResponse(['loggedIn' => false]);
    }

    jsonError('Unknown action');
}

jsonError('Method not allowed', 405);
