<?php
require_once __DIR__ . '/dbconnection.php';

function api_input(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);
    if (!is_array($data)) $data = $_POST;
    return is_array($data) ? $data : [];
}
function api_reply(array $payload, int $httpCode = 200): void {
    http_response_code($httpCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function api_ok(string $message, array $extra = []): void { api_reply(array_merge(['status' => 'success', 'message' => $message], $extra)); }
function api_error(string $message, int $httpCode = 400): void { api_reply(['status' => 'error', 'message' => $message], $httpCode); }
function api_stmt(string $query, string $types = '', array $params = []): mysqli_stmt {
    global $sql;
    $stmt = mysqli_prepare($sql, $query);
    if (!$stmt) { error_log('Pocket API prepare failed: ' . mysqli_error($sql)); api_error('Database query failed', 500); }
    if ($types !== '') {
        $refs = [];
        foreach ($params as $key => &$value) $refs[$key] = &$value;
        if (!mysqli_stmt_bind_param($stmt, $types, ...$refs)) { error_log('Pocket API bind failed: ' . mysqli_stmt_error($stmt)); api_error('Database query failed', 500); }
    }
    if (!mysqli_stmt_execute($stmt)) { error_log('Pocket API execute failed: ' . mysqli_stmt_error($stmt)); api_error('Database query failed', 500); }
    return $stmt;
}
function api_rows(mysqli_stmt $stmt): array {
    $result = mysqli_stmt_get_result($stmt);
    return $result ? mysqli_fetch_all($result, MYSQLI_ASSOC) : [];
}
function api_one(mysqli_stmt $stmt): ?array { return api_rows($stmt)[0] ?? null; }
function api_id($value): int { return filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) ?: 0; }
function api_current_user(): array {
    global $sql;
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $authorization = $headers['Authorization'] ?? $headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (!preg_match('/^Bearer\s+([a-f0-9]{64})$/i', trim($authorization), $match)) api_error('Sign in is required', 401);
    $tokenHash = hash('sha256', strtolower($match[1]));
    $stmt = api_stmt("SELECT u.user_id,u.full_name,u.mobile,u.email,u.family_id,u.is_admin FROM tbl_trip_user_session s JOIN tbl_trip_user u ON u.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>NOW() AND u.is_active=1 AND u.is_deleted='1' LIMIT 1", 's', [$tokenHash]);
    $user = api_one($stmt);
    if (!$user) api_error('Session expired. Please sign in again.', 401);
    api_stmt('UPDATE tbl_trip_user_session SET last_seen_at=NOW() WHERE token_hash=?', 's', [$tokenHash]);
    return $user;
}
function api_require_trip_member(int $tripId, int $userId): array {
    $row = api_one(api_stmt('SELECT t.trip_id,t.trip_name,t.admin_user_id FROM tbl_trip t JOIN tbl_trip_member tm ON tm.trip_id=t.trip_id WHERE t.trip_id=? AND tm.user_id=? AND t.is_deleted=\'1\' LIMIT 1', 'ii', [$tripId, $userId]));
    if (!$row) api_error('Trip not found or you are not a member', 404);
    return $row;
}
function api_is_trip_admin(int $tripId, int $userId): bool {
    $admins = api_rows(api_stmt('SELECT user_id FROM tbl_trip_admin WHERE trip_id=?', 'i', [$tripId]));
    if ($admins) return in_array($userId, array_map(fn($row) => (int)$row['user_id'], $admins), true);
    $trip = api_one(api_stmt('SELECT admin_user_id FROM tbl_trip WHERE trip_id=?', 'i', [$tripId]));
    return (int)($trip['admin_user_id'] ?? 0) === $userId;
}
function api_require_trip_admin(int $tripId, int $userId): array {
    $trip = api_require_trip_member($tripId, $userId);
    if (!api_is_trip_admin($tripId, $userId)) api_error('Only a trip admin can make this change', 403);
    return $trip;
}
function api_transaction(callable $callback) {
    global $sql;
    mysqli_begin_transaction($sql);
    try { $value = $callback(); mysqli_commit($sql); return $value; }
    catch (Throwable $error) { mysqli_rollback($sql); throw $error; }
}
