<?php
// Environment-configured connection. Never commit database credentials.
date_default_timezone_set('Asia/Kolkata');
header('Content-Type: application/json; charset=utf-8');

$localConfig = __DIR__ . '/config.local.php';
if (is_file($localConfig)) require_once $localConfig;
$configuredOrigins = getenv('APP_ALLOWED_ORIGINS') ?: ($APP_ALLOWED_ORIGINS ?? 'http://localhost:3000,http://localhost:5173');
$allowedOrigins = array_filter(array_map('trim', explode(',', $configuredOrigins)));
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? 'POST') !== 'POST') { http_response_code(405); echo json_encode(['status' => 'error', 'message' => 'Use POST for API requests']); exit; }

$host = getenv('DB_HOST') ?: ($DB_HOST ?? '');
$user = getenv('DB_USER') ?: ($DB_USER ?? '');
$password = getenv('DB_PASSWORD') ?: ($DB_PASSWORD ?? '');
$database = getenv('DB_NAME') ?: ($DB_NAME ?? '');
$appEnv = getenv('APP_ENV') ?: ($APP_ENV ?? 'production');
putenv('APP_ENV=' . $appEnv);
foreach (['APP_BOOTSTRAP_KEY', 'SMS_API_URL', 'SMS_API_TOKEN', 'SMS_SENDER'] as $setting) {
    if (getenv($setting) === false && isset($$setting)) putenv($setting . '=' . $$setting);
}
if ($host === '' || $user === '' || $database === '') {
    http_response_code(503);
    echo json_encode(['status' => 'error', 'message' => 'API database settings are not configured']);
    exit;
}

mysqli_report(MYSQLI_REPORT_OFF);
$sql = mysqli_connect($host, $user, $password, $database);
if (!$sql) {
    error_log('Pocket Trip Ledger database connection failed: ' . mysqli_connect_error());
    http_response_code(503);
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
    exit;
}
mysqli_set_charset($sql, 'utf8mb4');
