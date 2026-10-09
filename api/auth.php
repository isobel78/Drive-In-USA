<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';

setCorsHeaders();
header('Content-Type: application/json');

startSecureSession();

// Login throttling: after this many failed logins from one IP address within
// the window, further attempts from that IP are refused until the oldest of
// those failures ages out. Failures are stored in the login_attempts table.
const LOGIN_MAX_FAILURES   = 5;
const LOGIN_WINDOW_SECONDS = 900; // 15 minutes

// REMOTE_ADDR is set by the web server. X-Forwarded-For is deliberately NOT
// used: the client controls it, so trusting it would let an attacker dodge the limit.
// IPv6 clients are grouped by /64 network, because one machine usually controls
// a whole /64 and could otherwise rotate through addresses to dodge the limit.
function clientIp(): string {
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    if (strpos($ip, ':') !== false && ($bin = @inet_pton($ip)) !== false) {
        return bin2hex(substr($bin, 0, 8)) . '/64';
    }
    return substr($ip, 0, 45);
}

/** Seconds this IP must still wait, or 0 if it may try. */
function loginLockoutSeconds(PDO $pdo, string $ip): int {
    $cutoff = gmdate('Y-m-d H:i:s', time() - LOGIN_WINDOW_SECONDS);
    $stmt = $pdo->prepare(
        'SELECT attempted_at FROM login_attempts
         WHERE ip = :ip AND attempted_at > :cutoff
         ORDER BY attempted_at DESC LIMIT ' . LOGIN_MAX_FAILURES
    );
    $stmt->execute(['ip' => $ip, 'cutoff' => $cutoff]);
    $recent = $stmt->fetchAll(PDO::FETCH_COLUMN);
    if (count($recent) < LOGIN_MAX_FAILURES) return 0;
    // The oldest of the last N failures ages out first; then the IP drops below the limit.
    $oldest = strtotime(end($recent) . ' UTC');
    return max(1, $oldest + LOGIN_WINDOW_SECONDS - time());
}

function recordLoginFailure(PDO $pdo, string $ip): void {
    $pdo->prepare('INSERT INTO login_attempts (ip, attempted_at) VALUES (:ip, :t)')
        ->execute(['ip' => $ip, 't' => gmdate('Y-m-d H:i:s')]);
    // Housekeeping: drop anything older than a day.
    $pdo->prepare('DELETE FROM login_attempts WHERE attempted_at < :old')
        ->execute(['old' => gmdate('Y-m-d H:i:s', time() - 86400)]);
}

function clearLoginFailures(PDO $pdo, string $ip): void {
    $pdo->prepare('DELETE FROM login_attempts WHERE ip = :ip')->execute(['ip' => $ip]);
}

$method = $_SERVER['REQUEST_METHOD'];

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
    $data   = is_array($data) ? $data : [];
    $action = $data['action'] ?? '';

    if ($action === 'login') {
        $email    = is_string($data['email'] ?? null) ? trim($data['email']) : '';
        $password = is_string($data['password'] ?? null) ? $data['password'] : '';

        try {
            $pdo = getDB();
            $ip  = clientIp();

            // Check the limit BEFORE looking at the password, so a locked-out
            // client learns nothing about whether a guess was right.
            $wait = loginLockoutSeconds($pdo, $ip);
            if ($wait > 0) {
                header('Retry-After: ' . $wait);
                jsonError('Too many failed attempts. Try again in ' . (int)ceil($wait / 60) . ' minute(s).', 429);
            }

            // Always run both checks so response time doesn't reveal whether the email was right.
            $emailOk = hash_equals(ADMIN_EMAIL, $email);
            $passOk  = password_verify($password, ADMIN_PASSWORD_HASH);

            if (!($emailOk && $passOk)) {
                recordLoginFailure($pdo, $ip);
                jsonError('Invalid credentials', 401);
            }

            clearLoginFailures($pdo, $ip);
        } catch (Throwable $e) {
            // Fail closed: if throttling can't be checked, don't allow the login.
            error_log('auth login failed: ' . $e->getMessage());
            jsonError('Login is temporarily unavailable', 503);
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