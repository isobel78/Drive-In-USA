<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';

setCorsHeaders();
header('Content-Type: application/json');

// Only these columns are ever sent to the browser.
const THEATER_COLUMNS = 'id, name, address, city, state, state_long, lat, lng, description, website';

/**
 * Validate theater input (full body for POST, partial body for PUT).
 * Returns an error message, or null if the input is acceptable.
 * Limits match the VARCHAR sizes in schema.sql.
 */
function validTheater(array $d): ?string {
    $limits   = ['name' => 255, 'address' => 255, 'city' => 100, 'state' => 10,
                 'state_long' => 100, 'description' => 65535, 'website' => 500];
    $required = ['name', 'address', 'city', 'state', 'state_long'];
    $nullable = ['description', 'website']; // columns allow NULL

    foreach (['lat' => 90, 'lng' => 180] as $f => $max) {
        if (array_key_exists($f, $d) && (!is_numeric($d[$f]) || abs((float)$d[$f]) > $max)) {
            return "Invalid $f";
        }
    }
    foreach ($limits as $f => $max) {
        if (!array_key_exists($f, $d)) continue;
        if ($d[$f] === null && in_array($f, $nullable, true)) continue;
        if (!is_string($d[$f])) return "Invalid $f";
        $v = trim($d[$f]);
        if (strlen($v) > $max) return "$f is too long";
        if ($v === '' && in_array($f, $required, true)) return "$f cannot be empty";
        if ($f === 'website' && $v !== '' && !preg_match('#^https?://#i', $v)) {
            return 'Website must start with http:// or https://';
        }
    }
    return null;
}

$method = $_SERVER['REQUEST_METHOD'];

// GET /api/theaters.php — public, returns all theaters ordered by name
if ($method === 'GET') {
    try {
        $pdo = getDB();
        $stmt = $pdo->query('SELECT ' . THEATER_COLUMNS . ' FROM theaters ORDER BY name ASC');
        $theaters = $stmt->fetchAll();
        // Cast types so JSON encodes them correctly
        foreach ($theaters as &$t) {
            $t['lat']         = (float)$t['lat'];
            $t['lng']         = (float)$t['lng'];
            $t['description'] = $t['description'] ?? '';
            $t['website']     = $t['website'] ?? '';
        }
        jsonResponse($theaters);
    } catch (Throwable $e) {
        error_log('theaters GET failed: ' . $e->getMessage());
        jsonError('Failed to fetch theaters', 500);
    }
}

// POST /api/theaters.php — admin only, create theater
if ($method === 'POST') {
    requireAdmin();
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) jsonError('Invalid JSON body');

    $required = ['name', 'address', 'city', 'state', 'state_long', 'lat', 'lng'];
    foreach ($required as $field) {
        if (!isset($data[$field]) || $data[$field] === '') {
            jsonError("Missing required field: $field");
        }
    }
    if ($err = validTheater($data)) jsonError($err);

    try {
        $pdo = getDB();
        $stmt = $pdo->prepare('
            INSERT INTO theaters (name, address, city, state, state_long, lat, lng, description, website)
            VALUES (:name, :address, :city, :state, :state_long, :lat, :lng, :description, :website)
        ');
        $desc    = trim((string)($data['description'] ?? ''));
        $website = trim((string)($data['website'] ?? ''));
        $stmt->execute([
            'name'       => trim($data['name']),
            'address'    => trim($data['address']),
            'city'       => trim($data['city']),
            'state'      => trim($data['state']),
            'state_long' => trim($data['state_long']),
            'lat'        => (float)$data['lat'],
            'lng'        => (float)$data['lng'],
            'description'=> $desc    !== '' ? $desc    : null,
            'website'    => $website !== '' ? $website : null,
        ]);
        $id = $pdo->lastInsertId();
        $theater = $pdo->query('SELECT ' . THEATER_COLUMNS . ' FROM theaters WHERE id = ' . (int)$id)->fetch();
        $theater['lat']         = (float)$theater['lat'];
        $theater['lng']         = (float)$theater['lng'];
        $theater['description'] = $theater['description'] ?? '';
        $theater['website']     = $theater['website'] ?? '';
        jsonResponse($theater, 201);
    } catch (Throwable $e) {
        error_log('theaters POST failed: ' . $e->getMessage());
        jsonError('Failed to create theater', 500);
    }
}

// PUT /api/theaters.php?id=123 — admin only, update theater
if ($method === 'PUT') {
    requireAdmin();
    $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
    if (!$id) jsonError('Invalid or missing theater id');

    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) jsonError('Invalid JSON body');
    if ($err = validTheater($data)) jsonError($err);

    $allowed = ['name', 'address', 'city', 'state', 'state_long', 'lat', 'lng', 'description', 'website'];
    $fields = [];
    $params = ['id' => $id];
    foreach ($allowed as $field) {
        if (array_key_exists($field, $data)) {
            $fields[] = "$field = :$field";
            $params[$field] = in_array($field, ['lat', 'lng'], true)
                ? (float)$data[$field]
                : trim((string)$data[$field]);
        }
    }
    if (empty($fields)) jsonError('No valid fields to update');

    try {
        $pdo = getDB();
        $sql = 'UPDATE theaters SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $pdo->prepare($sql)->execute($params);
        $theater = $pdo->query('SELECT ' . THEATER_COLUMNS . ' FROM theaters WHERE id = ' . (int)$id)->fetch();
        if (!$theater) jsonError('Theater not found', 404);
        $theater['lat']         = (float)$theater['lat'];
        $theater['lng']         = (float)$theater['lng'];
        $theater['description'] = $theater['description'] ?? '';
        $theater['website']     = $theater['website'] ?? '';
        jsonResponse($theater);
    } catch (Throwable $e) {
        error_log('theaters PUT failed: ' . $e->getMessage());
        jsonError('Failed to update theater', 500);
    }
}

// DELETE /api/theaters.php?id=123 — admin only
if ($method === 'DELETE') {
    requireAdmin();
    $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
    if (!$id) jsonError('Invalid or missing theater id');

    try {
        $pdo = getDB();
        $stmt = $pdo->prepare('DELETE FROM theaters WHERE id = :id');
        $stmt->execute(['id' => $id]);
        if ($stmt->rowCount() === 0) jsonError('Theater not found', 404);
        jsonResponse(['success' => true]);
    } catch (Throwable $e) {
        error_log('theaters DELETE failed: ' . $e->getMessage());
        jsonError('Failed to delete theater', 500);
    }
}

jsonError('Method not allowed', 405);