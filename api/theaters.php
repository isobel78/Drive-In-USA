<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';

setCorsHeaders();
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

// GET /api/theaters.php — public, returns all theaters ordered by name
if ($method === 'GET') {
    try {
        $pdo = getDB();
        $stmt = $pdo->query('SELECT * FROM theaters ORDER BY name ASC');
        $theaters = $stmt->fetchAll();
        // Cast types so JSON encodes them correctly
        foreach ($theaters as &$t) {
            $t['lat']         = (float)$t['lat'];
            $t['lng']         = (float)$t['lng'];
            $t['description'] = $t['description'] ?? '';
            $t['website']     = $t['website'] ?? '';
            $t['added_by']    = $t['added_by'] ?? '';
        }
        jsonResponse($theaters);
    } catch (Exception $e) {
        jsonError('Failed to fetch theaters: ' . $e->getMessage(), 500);
    }
}

// POST /api/theaters.php — admin only, create theater
if ($method === 'POST') {
    requireAdmin();
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) jsonError('Invalid JSON body');

    $required = ['name', 'address', 'city', 'state', 'state_long', 'lat', 'lng'];
    foreach ($required as $field) {
        if (!isset($data[$field]) || $data[$field] === '') {
            jsonError("Missing required field: $field");
        }
    }

    try {
        $pdo = getDB();
        $stmt = $pdo->prepare('
            INSERT INTO theaters (name, address, city, state, state_long, lat, lng, description, website, added_by)
            VALUES (:name, :address, :city, :state, :state_long, :lat, :lng, :description, :website, :added_by)
        ');
        $desc    = trim($data['description'] ?? '');
        $website = trim($data['website'] ?? '');
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
            'added_by'   => $_SESSION['admin_email'] ?? null,
        ]);
        $id = $pdo->lastInsertId();
        $theater = $pdo->query("SELECT * FROM theaters WHERE id = $id")->fetch();
        $theater['lat'] = (float)$theater['lat'];
        $theater['lng'] = (float)$theater['lng'];
        jsonResponse($theater, 201);
    } catch (Exception $e) {
        jsonError('Failed to create theater: ' . $e->getMessage(), 500);
    }
}

// PUT /api/theaters.php?id=123 — admin only, update theater
if ($method === 'PUT') {
    requireAdmin();
    $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
    if (!$id) jsonError('Invalid or missing theater id');

    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) jsonError('Invalid JSON body');

    $allowed = ['name', 'address', 'city', 'state', 'state_long', 'lat', 'lng', 'description', 'website'];
    $fields = [];
    $params = ['id' => $id];
    foreach ($allowed as $field) {
        if (array_key_exists($field, $data)) {
            $fields[] = "$field = :$field";
            $params[$field] = in_array($field, ['lat', 'lng'])
                ? (float)$data[$field]
                : trim($data[$field]);
        }
    }
    if (empty($fields)) jsonError('No valid fields to update');

    try {
        $pdo = getDB();
        $sql = 'UPDATE theaters SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $pdo->prepare($sql)->execute($params);
        $theater = $pdo->query("SELECT * FROM theaters WHERE id = $id")->fetch();
        if (!$theater) jsonError('Theater not found', 404);
        $theater['lat'] = (float)$theater['lat'];
        $theater['lng'] = (float)$theater['lng'];
        jsonResponse($theater);
    } catch (Exception $e) {
        jsonError('Failed to update theater: ' . $e->getMessage(), 500);
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
    } catch (Exception $e) {
        jsonError('Failed to delete theater: ' . $e->getMessage(), 500);
    }
}

jsonError('Method not allowed', 405);
