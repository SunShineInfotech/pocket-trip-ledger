<?php
require_once __DIR__ . '/common.php';
$data = api_input(); $type = (int)($data['type'] ?? 0); $user = api_current_user(); $userId = (int)$user['user_id'];
if ($type === 1) {
    $trips = api_rows(api_stmt("SELECT t.trip_id id,t.trip_name name,t.start_date date,t.end_date endDate,t.admin_user_id adminUserId,COUNT(DISTINCT tm.user_id) memberCount FROM tbl_trip t JOIN tbl_trip_member tm ON tm.trip_id=t.trip_id WHERE tm.user_id=? AND t.is_deleted='1' GROUP BY t.trip_id ORDER BY t.start_date DESC,t.trip_id DESC", 'i', [$userId]));
    foreach ($trips as &$trip) {
        $id = (int)$trip['id'];
        $trip['id'] = (string)$trip['id']; $trip['adminUserId'] = (string)$trip['adminUserId'];
        $trip['adminUserIds'] = array_map(fn($r) => (string)$r['user_id'], api_rows(api_stmt('SELECT user_id FROM tbl_trip_admin WHERE trip_id=? ORDER BY user_id', 'i', [$id])));
        if (!$trip['adminUserIds']) $trip['adminUserIds'] = [$trip['adminUserId']];
        $trip['familyIds'] = array_map(fn($r) => (string)$r['family_id'], api_rows(api_stmt('SELECT family_id FROM tbl_trip_family_member WHERE trip_id=? ORDER BY family_id', 'i', [$id])));
        $trip['memberIds'] = array_map(fn($r) => (string)$r['user_id'], api_rows(api_stmt('SELECT user_id FROM tbl_trip_member WHERE trip_id=? ORDER BY user_id', 'i', [$id])));
    }
    unset($trip); api_ok('Trips loaded', ['data' => $trips]);
}
if ($type === 2) {
    $name = trim((string)($data['name'] ?? '')); $start = (string)($data['date'] ?? ''); $end = trim((string)($data['endDate'] ?? ''));
    $familyIds = array_values(array_unique(array_filter(array_map('api_id', (array)($data['familyIds'] ?? [])))));
    $memberIds = array_values(array_unique(array_filter(array_map('api_id', (array)($data['memberIds'] ?? [])))));
    $adminIds = array_values(array_unique(array_filter(array_map('api_id', (array)($data['adminUserIds'] ?? [])))));
    if ($name === '' || strlen($name) > 150 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) || ($end !== '' && (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $end) || $end < $start)) || !$familyIds || !$memberIds) api_error('Enter a trip name, valid dates, families, and travellers');
    if (!in_array($userId, $memberIds, true)) $memberIds[] = $userId;
    if (!$adminIds) $adminIds = [$userId];
    if (!in_array($userId, $adminIds, true)) $adminIds[] = $userId;
    if (array_diff($adminIds, $memberIds)) api_error('Every trip admin must also be a traveller');
    $memberPlaceholders = implode(',', array_fill(0, count($memberIds), '?'));
    $validMembers = api_rows(api_stmt("SELECT user_id,family_id FROM tbl_trip_user WHERE is_active=1 AND is_deleted='1' AND user_id IN ($memberPlaceholders)", str_repeat('i', count($memberIds)), $memberIds));
    if (count($validMembers) !== count($memberIds)) api_error('One or more selected travellers are unavailable');
    // The trip creator must also be attached to one of its families. Include
    // their family automatically so no expense is left outside the family ledger.
    $memberFamilyById = [];
    foreach ($validMembers as $member) $memberFamilyById[(int)$member['user_id']] = (int)($member['family_id'] ?? 0);
    $creatorFamilyId = $memberFamilyById[$userId] ?? 0;
    if ($creatorFamilyId < 1) api_error('Assign the trip creator to a family before creating a trip');
    if (!in_array($creatorFamilyId, $familyIds, true)) $familyIds[] = $creatorFamilyId;
    $familyPlaceholders = implode(',', array_fill(0, count($familyIds), '?'));
    $validFamilies = api_rows(api_stmt("SELECT family_id FROM tbl_trip_family WHERE is_deleted='1' AND family_id IN ($familyPlaceholders)", str_repeat('i', count($familyIds)), $familyIds));
    if (count($validFamilies) !== count($familyIds)) api_error('One or more selected families are unavailable');
    $familySet = array_flip($familyIds);
    foreach ($validMembers as $member) {
        $memberFamilyId = (int)($member['family_id'] ?? 0);
        if ($memberFamilyId < 1 || !isset($familySet[$memberFamilyId])) api_error('Each selected traveller must belong to one of the selected families');
    }
    if (!(int)$user['is_admin']) api_error('Only an administrator can create trips', 403);
    global $sql;
    $tripId = api_transaction(function () use ($name, $start, $end, $familyIds, $memberIds, $memberFamilyById, $adminIds, $userId) {
        global $sql;
        api_stmt('INSERT INTO tbl_trip (trip_name,start_date,end_date,admin_user_id) VALUES (?,?,?,?)', 'sssi', [$name,$start,$end !== '' ? $end : null,$userId]);
        $id = (int)mysqli_insert_id($sql);
        foreach ($familyIds as $familyId) api_stmt('INSERT INTO tbl_trip_family_member (trip_id,family_id) VALUES (?,?)', 'ii', [$id,$familyId]);
        foreach ($memberIds as $memberId) {
            $familyId = (int)($memberFamilyById[$memberId] ?? 0);
            api_stmt('INSERT INTO tbl_trip_member (trip_id,user_id,family_id) VALUES (?,?,?)', 'iii', [$id,$memberId,$familyId]);
        }
        foreach ($adminIds as $adminId) api_stmt('INSERT INTO tbl_trip_admin (trip_id,user_id) VALUES (?,?)', 'ii', [$id,$adminId]);
        return $id;
    });
    api_ok('Trip created', ['trip_id' => $tripId]);
}
if ($type === 3) {
    $tripId = api_id($data['trip_id'] ?? 0); if (!$tripId) api_error('Trip ID is required');
    api_require_trip_member($tripId, $userId);
    $trip = api_one(api_stmt("SELECT trip_id id,trip_name name,start_date date,end_date endDate,admin_user_id adminUserId FROM tbl_trip WHERE trip_id=? AND is_deleted='1' LIMIT 1", 'i', [$tripId]));
    $trip['id'] = (string)$trip['id']; $trip['adminUserId'] = (string)$trip['adminUserId'];
    $trip['familyIds'] = array_map(fn($r) => (string)$r['family_id'], api_rows(api_stmt('SELECT family_id FROM tbl_trip_family_member WHERE trip_id=? ORDER BY family_id', 'i', [$tripId])));
    $trip['memberIds'] = array_map(fn($r) => (string)$r['user_id'], api_rows(api_stmt('SELECT user_id FROM tbl_trip_member WHERE trip_id=? ORDER BY user_id', 'i', [$tripId])));
    $trip['families'] = api_rows(api_stmt("SELECT f.family_id id,f.family_name name,f.head_user_id headUserId FROM tbl_trip_family_member tf JOIN tbl_trip_family f ON f.family_id=tf.family_id WHERE tf.trip_id=? AND f.is_deleted='1' ORDER BY f.family_name", 'i', [$tripId]));
    $trip['users'] = api_rows(api_stmt("SELECT u.user_id id,u.full_name name,u.mobile,u.email,tm.family_id familyId FROM tbl_trip_member tm JOIN tbl_trip_user u ON u.user_id=tm.user_id WHERE tm.trip_id=? AND u.is_deleted='1' ORDER BY u.full_name", 'i', [$tripId]));
    foreach ($trip['families'] as &$family) { $family['id'] = (string)$family['id']; $family['headUserId'] = (string)($family['headUserId'] ?? ''); } unset($family);
    foreach ($trip['users'] as &$member) { $member['id'] = (string)$member['id']; $member['familyId'] = (string)($member['familyId'] ?? ''); } unset($member);
    api_ok('Trip details loaded', ['data' => $trip]);
}
if ($type === 4) {
    $tripId = api_id($data['trip_id'] ?? 0); if (!$tripId) api_error('Trip ID is required');
    api_require_trip_admin($tripId, $userId);
    $memberIds = array_values(array_unique(array_filter(array_map('api_id', (array)($data['memberIds'] ?? [])))));
    if (!$memberIds || !in_array($userId, $memberIds, true)) api_error('Keep yourself and at least one traveller in the trip');
    $memberPlaceholders = implode(',', array_fill(0, count($memberIds), '?'));
    $validMembers = api_rows(api_stmt("SELECT user_id,family_id FROM tbl_trip_user WHERE is_active=1 AND is_deleted='1' AND user_id IN ($memberPlaceholders)", str_repeat('i', count($memberIds)), $memberIds));
    if (count($validMembers) !== count($memberIds)) api_error('One or more selected travellers are unavailable');
    $tripFamilies = array_map(fn($r) => (int)$r['family_id'], api_rows(api_stmt('SELECT family_id FROM tbl_trip_family_member WHERE trip_id=?', 'i', [$tripId])));
    $existingMemberRows = api_rows(api_stmt('SELECT user_id,family_id FROM tbl_trip_member WHERE trip_id=?', 'i', [$tripId]));
    $snapshotFamilyByUser = [];
    foreach ($existingMemberRows as $existingMember) $snapshotFamilyByUser[(int)$existingMember['user_id']] = (int)$existingMember['family_id'];
    foreach ($validMembers as &$member) {
        $memberId = (int)$member['user_id'];
        $member['trip_family_id'] = $snapshotFamilyByUser[$memberId] ?? (int)$member['family_id'];
        if (!in_array((int)$member['trip_family_id'], $tripFamilies, true)) api_error('Each selected traveller must belong to a family on this trip');
    }
    unset($member);
    $existingAdmins = array_map(fn($r) => (int)$r['user_id'], api_rows(api_stmt('SELECT user_id FROM tbl_trip_admin WHERE trip_id=?', 'i', [$tripId])));
    if ($existingAdmins && array_diff($existingAdmins, $memberIds)) api_error('Trip admins must remain travellers in the trip');
    api_transaction(function () use ($tripId, $validMembers) {
        api_stmt('DELETE FROM tbl_trip_member WHERE trip_id=?', 'i', [$tripId]);
        foreach ($validMembers as $member) api_stmt('INSERT INTO tbl_trip_member (trip_id,user_id,family_id) VALUES (?,?,?)', 'iii', [$tripId,(int)$member['user_id'],(int)$member['trip_family_id']]);
    });
    api_ok('Trip travellers updated');
}
if ($type === 5) {
    $tripId = api_id($data['trip_id'] ?? 0); if (!$tripId) api_error('Trip ID is required');
    api_require_trip_admin($tripId, $userId);
    $adminIds = array_values(array_unique(array_filter(array_map('api_id', (array)($data['adminUserIds'] ?? [])))));
    if (!$adminIds) api_error('Choose at least one trip admin');
    $memberIds = array_map(fn($r) => (int)$r['user_id'], api_rows(api_stmt('SELECT user_id FROM tbl_trip_member WHERE trip_id=?', 'i', [$tripId])));
    if (array_diff($adminIds, $memberIds)) api_error('Every trip admin must also be a traveller');
    api_transaction(function () use ($tripId, $adminIds) {
        api_stmt('DELETE FROM tbl_trip_admin WHERE trip_id=?', 'i', [$tripId]);
        foreach ($adminIds as $adminId) api_stmt('INSERT INTO tbl_trip_admin (trip_id,user_id) VALUES (?,?)', 'ii', [$tripId,$adminId]);
        api_stmt('UPDATE tbl_trip SET admin_user_id=? WHERE trip_id=?', 'ii', [$adminIds[0],$tripId]);
    });
    api_ok('Trip admins updated');
}
api_error('Invalid request type');
