<?php
require_once __DIR__ . '/common.php';
$data = api_input(); $type = (int)($data['type'] ?? 0); $user = api_current_user(); $userId = (int)$user['user_id'];
if ($type === 1) {
    $rows = api_rows(api_stmt("SELECT f.family_id id,f.family_name name,f.head_user_id headUserId,COALESCE((SELECT h.full_name FROM tbl_trip_user h WHERE h.user_id=f.head_user_id),'') head_name,(SELECT COUNT(*) FROM tbl_trip_user u WHERE u.family_id=f.family_id AND u.is_deleted='1') member_count FROM tbl_trip_family f WHERE f.is_deleted='1' ORDER BY f.family_name"));
    foreach ($rows as &$row) { $row['id'] = (string)$row['id']; $row['headUserId'] = (string)($row['headUserId'] ?? ''); } unset($row);
    api_ok('Families loaded', ['data' => $rows]);
}
if ($type === 2) {
    if (!(int)$user['is_admin']) api_error('Only an administrator can add families', 403);
    $name = trim((string)($data['name'] ?? ''));
    if ($name === '' || mb_strlen($name) > 100) api_error('Enter a family name (up to 100 characters)');
    if (api_one(api_stmt("SELECT family_id FROM tbl_trip_family WHERE LOWER(family_name)=LOWER(?) AND is_deleted='1' LIMIT 1", 's', [$name]))) api_error('That family name already exists', 409);
    global $sql; api_stmt('INSERT INTO tbl_trip_family (family_name,head_user_id) VALUES (?,?)', 'si', [$name,$userId]);
    api_ok('Family created', ['family_id' => mysqli_insert_id($sql)]);
}
if ($type === 3) {
    if (!(int)$user['is_admin']) api_error('Only an administrator can change family membership', 403);
    $familyId = api_id($data['family_id'] ?? 0); $memberId = api_id($data['user_id'] ?? 0);
    if (!$familyId || !$memberId || !api_one(api_stmt("SELECT family_id FROM tbl_trip_family WHERE family_id=? AND is_deleted='1'", 'i', [$familyId]))) api_error('Choose a valid family and member');
    api_stmt('UPDATE tbl_trip_user SET family_id=?,updated_at=NOW() WHERE user_id=? AND is_deleted=\'1\'', 'ii', [$familyId,$memberId]);
    api_ok('Member family updated');
}
api_error('Invalid request type');
