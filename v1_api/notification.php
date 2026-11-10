<?php
require_once __DIR__ . '/common.php';
$data = api_input(); $type = (int)($data['type'] ?? 0); $user = api_current_user(); $userId = (int)$user['user_id'];
if ($type === 1) {
    $rows = api_rows(api_stmt('SELECT n.notification_id id,n.trip_id tripId,n.message text,n.is_read unread,n.c_date createdAt FROM tbl_trip_notification n WHERE n.user_id=? ORDER BY n.c_date DESC,n.notification_id DESC LIMIT 100', 'i', [$userId]));
    foreach ($rows as &$row) { $row['id'] = (string)$row['id']; $row['tripId'] = $row['tripId'] === null ? null : (string)$row['tripId']; $row['unread'] = !(bool)$row['unread']; }
    unset($row); api_ok('Notifications loaded', ['data' => $rows]);
}
if ($type === 2) {
    $id = api_id($data['notification_id'] ?? 0);
    if (!$id) api_error('Notification ID is required');
    api_stmt('UPDATE tbl_trip_notification SET is_read=1 WHERE notification_id=? AND user_id=?', 'ii', [$id,$userId]);
    api_ok('Notification marked as read');
}
api_error('Invalid request type');
