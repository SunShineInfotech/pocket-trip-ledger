<?php
require_once __DIR__ . '/common.php';
$data = api_input(); $type = (int)($data['type'] ?? 0); $user = api_current_user();
if ($type === 1) {
    $rows = api_rows(api_stmt("SELECT u.user_id id,u.full_name name,u.mobile,u.email,u.family_id familyId,f.family_name family_name FROM tbl_trip_user u LEFT JOIN tbl_trip_family f ON f.family_id=u.family_id WHERE u.is_deleted='1' AND u.is_active=1 ORDER BY u.full_name"));
    foreach ($rows as &$row) { $row['id'] = (string)$row['id']; $row['familyId'] = (string)($row['familyId'] ?? ''); } unset($row);
    api_ok('Members loaded', ['data' => $rows]);
}
if ($type === 2) {
    if (!(int)$user['is_admin']) api_error('Only an administrator can manage members', 403);
    $id = api_id($data['user_id'] ?? 0); $name = trim((string)($data['name'] ?? '')); $mobile = preg_replace('/\D+/', '', (string)($data['mobile'] ?? '')); $email = strtolower(trim((string)($data['email'] ?? ''))); $familyId = api_id($data['family_id'] ?? 0);
    if ($name === '' || strlen($name) > 120 || strlen($mobile) < 10 || strlen($mobile) > 15 || !filter_var($email, FILTER_VALIDATE_EMAIL) || !$familyId) api_error('Enter a name, valid mobile, email, and family');
    if (!api_one(api_stmt("SELECT family_id FROM tbl_trip_family WHERE family_id=? AND is_deleted='1'", 'i', [$familyId]))) api_error('Family not found', 404);
    $duplicate = api_one(api_stmt("SELECT user_id FROM tbl_trip_user WHERE (mobile=? OR email=?) AND user_id<>? AND is_deleted='1' LIMIT 1", 'ssi', [$mobile,$email,$id]));
    if ($duplicate) api_error('Mobile number or email is already in use', 409);
    if ($id) {
        api_stmt("UPDATE tbl_trip_user SET family_id=?,full_name=?,mobile=?,email=?,updated_at=NOW() WHERE user_id=? AND is_deleted='1'", 'isssi', [$familyId,$name,$mobile,$email,$id]);
        api_ok('Member updated', ['user_id' => $id]);
    }
    global $sql; api_stmt('INSERT INTO tbl_trip_user (family_id,full_name,mobile,email) VALUES (?,?,?,?)', 'isss', [$familyId,$name,$mobile,$email]);
    api_ok('Member added', ['user_id' => mysqli_insert_id($sql)]);
}
api_error('Invalid request type');
