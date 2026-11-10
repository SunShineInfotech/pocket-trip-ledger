<?php
require_once __DIR__ . '/common.php';
$data = api_input(); $type = (int)($data['type'] ?? 0); $user = api_current_user();
if ($type === 1) {
    $tripId = api_id($data['trip_id'] ?? 0); api_require_trip_member($tripId, (int)$user['user_id']);
    $rows = api_rows(api_stmt("SELECT category_id id,category_name name,trip_id tripId FROM tbl_trip_category WHERE is_deleted='1' AND (trip_id IS NULL OR trip_id=?) ORDER BY category_name", 'i', [$tripId]));
    foreach ($rows as &$row) { $row['id'] = (string)$row['id']; $row['tripId'] = $row['tripId'] === null ? null : (string)$row['tripId']; } unset($row);
    api_ok('Categories loaded', ['data' => $rows]);
}
if ($type === 2) {
    $tripId = api_id($data['trip_id'] ?? 0); $name = trim((string)($data['name'] ?? ''));
    if (!$tripId || $name === '' || mb_strlen($name) > 60) api_error('Enter a trip and category name (up to 60 characters)');
    api_require_trip_member($tripId, (int)$user['user_id']);
    if (api_one(api_stmt("SELECT category_id FROM tbl_trip_category WHERE trip_id=? AND LOWER(category_name)=LOWER(?) AND is_deleted='1' LIMIT 1", 'is', [$tripId,$name]))) api_error('That category already exists', 409);
    global $sql; api_stmt('INSERT INTO tbl_trip_category (trip_id,category_name,created_by) VALUES (?,?,?)', 'isi', [$tripId,$name,(int)$user['user_id']]);
    api_ok('Category added', ['category_id' => mysqli_insert_id($sql)]);
}
api_error('Invalid request type');
