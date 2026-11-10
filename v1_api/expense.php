<?php
require_once __DIR__ . '/common.php';
$data = api_input(); $type = (int)($data['type'] ?? 0); $user = api_current_user(); $userId = (int)$user['user_id'];
if ($type === 1) {
    $tripId = api_id($data['trip_id'] ?? 0); api_require_trip_member($tripId, $userId);
    $expenses = api_rows(api_stmt("SELECT e.expense_id id,e.trip_id tripId,e.title,e.category_id categoryId,e.amount,e.paid_by_user_id paidByUserId,e.expense_date date,e.remark,e.updated_flag updated FROM tbl_trip_expense e WHERE e.trip_id=? AND e.is_deleted='1' ORDER BY e.expense_date DESC,e.expense_id DESC", 'i', [$tripId]));
    foreach ($expenses as &$expense) {
        $expense['amount'] = (float)$expense['amount']; $expense['splits'] = api_rows(api_stmt('SELECT user_id userId,share_amount shareAmount FROM tbl_trip_expense_split WHERE expense_id=? ORDER BY user_id', 'i', [(int)$expense['id']]));
        foreach ($expense['splits'] as &$split) { $split['userId'] = (string)$split['userId']; $split['shareAmount'] = (float)$split['shareAmount']; } unset($split);
        $expense['id'] = (string)$expense['id']; $expense['tripId'] = (string)$expense['tripId']; $expense['categoryId'] = (string)$expense['categoryId']; $expense['paidByUserId'] = (string)$expense['paidByUserId'];
    }
    unset($expense); api_ok('Trip expenses loaded', ['data' => $expenses]);
}
if ($type === 2) {
    $expenseId = api_id($data['id'] ?? $data['expense_id'] ?? 0); $tripId = api_id($data['tripId'] ?? $data['trip_id'] ?? 0); $title = trim((string)($data['title'] ?? '')); $categoryId = api_id($data['categoryId'] ?? $data['category_id'] ?? 0); $payerId = api_id($data['paidByUserId'] ?? $data['paid_by_user_id'] ?? 0); $date = (string)($data['date'] ?? ''); $remark = trim((string)($data['remark'] ?? '')); $amount = round((float)($data['amount'] ?? 0), 2); $splits = (array)($data['splits'] ?? []);
    if (!$tripId || $title === '' || mb_strlen($title) > 160 || !$categoryId || !$payerId || $amount <= 0 || !is_finite($amount) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !$splits) api_error('Enter a valid expense, payer, category, date, and at least one split');
    api_require_trip_member($tripId, $userId);
    $isTripAdmin = api_is_trip_admin($tripId, $userId);
    if (!$isTripAdmin && $payerId !== $userId) api_error('You can only add an expense paid by yourself', 403);
    if ($expenseId) {
        $existingExpense = api_one(api_stmt("SELECT expense_id,paid_by_user_id FROM tbl_trip_expense WHERE expense_id=? AND trip_id=? AND is_deleted='1'", 'ii', [$expenseId,$tripId]));
        if (!$existingExpense) api_error('Expense not found', 404);
        if (!$isTripAdmin && (int)$existingExpense['paid_by_user_id'] !== $userId) api_error('You can only edit your own expenses', 403);
    }
    if (!api_one(api_stmt("SELECT category_id FROM tbl_trip_category WHERE category_id=? AND is_deleted='1' AND (trip_id IS NULL OR trip_id=?)", 'ii', [$categoryId,$tripId]))) api_error('Category is not available for this trip');
    $members = api_rows(api_stmt('SELECT user_id FROM tbl_trip_member WHERE trip_id=?', 'i', [$tripId])); $memberIds = array_map(fn($row) => (int)$row['user_id'], $members);
    if (!in_array($payerId, $memberIds, true)) api_error('Payer must be a member of this trip');
    $splitMap = []; $sumCents = 0;
    foreach ($splits as $split) { $splitUser = api_id($split['userId'] ?? $split['user_id'] ?? 0); $share = round((float)($split['shareAmount'] ?? $split['share_amount'] ?? 0), 2); if (!$splitUser || $share < 0 || !is_finite($share) || !in_array($splitUser, $memberIds, true)) api_error('Expense splits must use trip members and valid amounts'); if (isset($splitMap[$splitUser])) api_error('A trip member can only appear once in the split'); $splitMap[$splitUser] = $share; $sumCents += (int)round($share * 100); }
    if ($sumCents !== (int)round($amount * 100)) api_error('Split amounts must add up to the full expense amount');
    global $sql;
    $savedId = api_transaction(function () use ($expenseId,$tripId,$title,$categoryId,$amount,$payerId,$date,$remark,$userId,$splitMap,$user) {
        global $sql;
        if ($expenseId) {
            api_stmt("UPDATE tbl_trip_expense SET title=?,category_id=?,amount=?,paid_by_user_id=?,expense_date=?,remark=?,updated_flag=1,updated_by=?,updated_at=NOW() WHERE expense_id=? AND trip_id=?", 'sidissiii', [$title,$categoryId,$amount,$payerId,$date,$remark,$userId,$expenseId,$tripId]);
            $id = $expenseId;
            api_stmt('DELETE FROM tbl_trip_expense_split WHERE expense_id=?', 'i', [$id]);
        } else {
            api_stmt('INSERT INTO tbl_trip_expense (trip_id,title,category_id,amount,paid_by_user_id,expense_date,remark,created_by) VALUES (?,?,?,?,?,?,?,?)', 'isidissi', [$tripId,$title,$categoryId,$amount,$payerId,$date,$remark,$userId]);
            $id = (int)mysqli_insert_id($sql);
        }
        foreach ($splitMap as $splitUserId => $shareAmount) api_stmt('INSERT INTO tbl_trip_expense_split (expense_id,user_id,share_amount) VALUES (?,?,?)', 'iid', [$id,$splitUserId,$shareAmount]);
        $message = $user['full_name'] . ($expenseId ? ' updated ' : ' added ') . $title;
        foreach (api_rows(api_stmt('SELECT user_id FROM tbl_trip_member WHERE trip_id=? AND user_id<>?', 'ii', [$tripId,$userId])) as $member) api_stmt('INSERT INTO tbl_trip_notification (trip_id,user_id,message) VALUES (?,?,?)', 'iis', [$tripId,(int)$member['user_id'],$message]);
        return $id;
    });
    api_ok('Expense saved', ['expense_id' => $savedId]);
}
if ($type === 3) {
    $expenseId = api_id($data['expense_id'] ?? 0); $tripId = api_id($data['trip_id'] ?? 0); if (!$expenseId || !$tripId) api_error('Expense and trip IDs are required');
    api_require_trip_member($tripId, $userId);
    api_require_trip_member($tripId, $userId);
    $expense = api_one(api_stmt("SELECT expense_id,title,paid_by_user_id FROM tbl_trip_expense WHERE expense_id=? AND trip_id=? AND is_deleted='1'", 'ii', [$expenseId,$tripId])); if (!$expense) api_error('Expense not found', 404);
    if (!api_is_trip_admin($tripId, $userId) && (int)$expense['paid_by_user_id'] !== $userId) api_error('You can only delete your own expenses', 403);
    api_stmt("UPDATE tbl_trip_expense SET is_deleted='0',updated_by=?,updated_at=NOW() WHERE expense_id=?", 'ii', [$userId,$expenseId]);
    api_ok('Expense deleted');
}
api_error('Invalid request type');
