<?php
require_once __DIR__ . '/common.php';
$data = api_input();
$type = (int)($data['type'] ?? 0);

function deliver_trip_otp(string $mobile, string $code): bool {
    $url = getenv('SMS_API_URL') ?: '';
    if ($url === '') return (getenv('APP_ENV') ?: 'production') === 'local';
    if (!function_exists('curl_init')) return false;
    $payload = json_encode(['to' => $mobile, 'sender' => getenv('SMS_SENDER') ?: '', 'message' => "Your Pocket Trip Ledger verification code is $code. It expires in 5 minutes."]);
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_HTTPHEADER => array_filter(['Content-Type: application/json', (getenv('SMS_API_TOKEN') ? 'Authorization: Bearer ' . getenv('SMS_API_TOKEN') : null)]), CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12]);
    $body = curl_exec($ch); $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    return $body !== false && $status >= 200 && $status < 300;
}

if ($type === 0) { // One-time first administrator bootstrap, protected by an out-of-band secret.
    $configuredKey = getenv('APP_BOOTSTRAP_KEY') ?: '';
    $providedKey = (string)($data['bootstrap_key'] ?? '');
    if ($configuredKey === '' || !hash_equals($configuredKey, $providedKey)) api_error('Invalid bootstrap key', 403);
    $count = api_one(api_stmt('SELECT COUNT(*) total FROM tbl_trip_user'));
    if ((int)($count['total'] ?? 0) !== 0) api_error('Initial administrator has already been created', 409);
    $name = trim((string)($data['name'] ?? '')); $mobile = preg_replace('/\D+/', '', (string)($data['mobile'] ?? '')); $email = strtolower(trim((string)($data['email'] ?? ''))); $family = trim((string)($data['family_name'] ?? ''));
    if ($name === '' || strlen($mobile) < 10 || strlen($mobile) > 15 || !filter_var($email, FILTER_VALIDATE_EMAIL) || $family === '') api_error('Enter administrator name, valid mobile, email, and family name');
    $userId = api_transaction(function () use ($family, $name, $mobile, $email) {
        global $sql;
        api_stmt('INSERT INTO tbl_trip_family (family_name) VALUES (?)', 's', [$family]); $familyId = (int)mysqli_insert_id($sql);
        api_stmt('INSERT INTO tbl_trip_user (family_id,full_name,mobile,email,is_admin) VALUES (?,?,?,?,1)', 'isss', [$familyId,$name,$mobile,$email]); $userId = (int)mysqli_insert_id($sql);
        api_stmt('UPDATE tbl_trip_family SET head_user_id=? WHERE family_id=?', 'ii', [$userId,$familyId]);
        return $userId;
    });
    api_ok('Initial administrator created. Request a sign-in code to continue.', ['user_id' => $userId]);
}

if ($type === 1) { // Request one-time sign-in code.
    $mobile = preg_replace('/\D+/', '', (string)($data['mobile'] ?? ''));
    if (strlen($mobile) < 10 || strlen($mobile) > 15) api_error('Enter a valid mobile number');
    $user = api_one(api_stmt("SELECT user_id FROM tbl_trip_user WHERE mobile=? AND is_active=1 AND is_deleted='1' LIMIT 1", 's', [$mobile]));
    if (!$user) api_error('This mobile number is not registered', 404);
    $recent = api_one(api_stmt('SELECT COUNT(*) total FROM tbl_trip_login_otp WHERE user_id=? AND c_date>DATE_SUB(NOW(),INTERVAL 15 MINUTE)', 'i', [(int)$user['user_id']]));
    if ((int)($recent['total'] ?? 0) >= 3) api_error('Too many code requests. Wait 15 minutes and try again.', 429);
    $code = (string)random_int(1000, 999999); $code = str_pad($code, 6, '0', STR_PAD_LEFT);
    $expiresAt = date('Y-m-d H:i:s', time() + 300);
    api_stmt('INSERT INTO tbl_trip_login_otp (user_id,otp_hash,expires_at) VALUES (?,?,?)', 'iss', [(int)$user['user_id'],password_hash($code,PASSWORD_DEFAULT),$expiresAt]);
    if (!deliver_trip_otp($mobile, $code)) api_error('OTP delivery is not configured. Set SMS_API_URL or use APP_ENV=local for development.');
    $extra = (getenv('APP_ENV') ?: 'production') === 'local' ? ['debug_otp' => $code] : [];
    api_ok('Sign-in code sent. It expires in 5 minutes.', $extra);
}

if ($type === 2) { // Verify code and issue opaque bearer token.
    $mobile = preg_replace('/\D+/', '', (string)($data['mobile'] ?? '')); $code = preg_replace('/\D+/', '', (string)($data['otp'] ?? ''));
    if ($mobile === '' || strlen($code) !== 6) api_error('Enter your mobile number and 6-digit code');
    $user = api_one(api_stmt("SELECT user_id,full_name,mobile,email,family_id,is_admin FROM tbl_trip_user WHERE mobile=? AND is_active=1 AND is_deleted='1' LIMIT 1", 's', [$mobile]));
    if (!$user) api_error('This mobile number is not registered', 404);
    $otp = api_one(api_stmt('SELECT otp_id,otp_hash,attempts FROM tbl_trip_login_otp WHERE user_id=? AND consumed_at IS NULL AND expires_at>NOW() ORDER BY otp_id DESC LIMIT 1', 'i', [(int)$user['user_id']]));
    if (!$otp || (int)$otp['attempts'] >= 5) api_error('Code expired. Request a new one.', 401);
    if (!password_verify($code, $otp['otp_hash'])) { api_stmt('UPDATE tbl_trip_login_otp SET attempts=attempts+1 WHERE otp_id=?', 'i', [(int)$otp['otp_id']]); api_error('That code does not match', 401); }
    $token = bin2hex(random_bytes(32)); $tokenHash = hash('sha256', $token); $expiresAt = date('Y-m-d H:i:s', time() + 60 * 60 * 24 * 30);
    api_transaction(function () use ($otp, $user, $tokenHash, $expiresAt) {
        api_stmt('UPDATE tbl_trip_login_otp SET consumed_at=NOW() WHERE otp_id=?', 'i', [(int)$otp['otp_id']]);
        api_stmt('INSERT INTO tbl_trip_user_session (user_id,token_hash,expires_at) VALUES (?,?,?)', 'iss', [(int)$user['user_id'],$tokenHash,$expiresAt]);
    });
    api_ok('Signed in', ['token' => $token, 'expires_at' => $expiresAt, 'user' => $user]);
}

if ($type === 5) { // Password login: the registered mobile's last four digits.
    $mobile = preg_replace('/\D+/', '', (string)($data['mobile'] ?? ''));
    $loginPassword = preg_replace('/\D+/', '', (string)($data['password'] ?? ''));
    if (strlen($mobile) < 10 || strlen($mobile) > 15 || strlen($loginPassword) !== 4) api_error('Enter your registered mobile number and password', 401);
    $user = api_one(api_stmt("SELECT user_id,full_name,mobile,email,family_id,is_admin FROM tbl_trip_user WHERE mobile=? AND is_active=1 AND is_deleted='1' LIMIT 1", 's', [$mobile]));
    if (!$user || !hash_equals(substr((string)$user['mobile'], -4), $loginPassword)) api_error('Mobile number or password is incorrect', 401);
    $token = bin2hex(random_bytes(32)); $tokenHash = hash('sha256', $token); $expiresAt = date('Y-m-d H:i:s', time() + 60 * 60 * 24 * 30);
    api_stmt('INSERT INTO tbl_trip_user_session (user_id,token_hash,expires_at) VALUES (?,?,?)', 'iss', [(int)$user['user_id'],$tokenHash,$expiresAt]);
    api_ok('Signed in', ['token' => $token, 'expires_at' => $expiresAt, 'user' => $user]);
}

if ($type === 3) { $user = api_current_user(); api_ok('Current user loaded', ['user' => $user]); }
if ($type === 4) {
    $headers = function_exists('getallheaders') ? getallheaders() : []; $authorization = $headers['Authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (!preg_match('/^Bearer\s+([a-f0-9]{64})$/i', trim($authorization), $match)) api_error('Sign in is required', 401);
    api_stmt('DELETE FROM tbl_trip_user_session WHERE token_hash=?', 's', [hash('sha256', strtolower($match[1]))]); api_ok('Signed out');
}
api_error('Invalid request type');
