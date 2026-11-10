<?php
require_once __DIR__ . '/common.php';
$data = api_input();
$type = (int)($data['type'] ?? 0);
$user = api_current_user();
$userId = (int)$user['user_id'];

if ($type !== 1) api_error('Invalid request type');
$tripId = api_id($data['trip_id'] ?? 0);
if (!$tripId) api_error('Trip ID is required');
api_require_trip_member($tripId, $userId);

$throughDate = trim((string)($data['through_date'] ?? ''));
if ($throughDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $throughDate)) api_error('Use a valid through_date in YYYY-MM-DD format');

$families = api_rows(api_stmt("SELECT f.family_id id,f.family_name name FROM tbl_trip_family_member tf JOIN tbl_trip_family f ON f.family_id=tf.family_id WHERE tf.trip_id=? AND f.is_deleted='1' ORDER BY f.family_name", 'i', [$tripId]));
$people = api_rows(api_stmt("SELECT u.user_id id,u.full_name name,tm.family_id familyId FROM tbl_trip_member tm JOIN tbl_trip_user u ON u.user_id=tm.user_id WHERE tm.trip_id=? AND u.is_deleted='1' ORDER BY u.full_name", 'i', [$tripId]));
foreach ($families as &$family) $family['id'] = (string)$family['id'];
unset($family);
foreach ($people as &$person) { $person['id'] = (string)$person['id']; $person['familyId'] = (string)$person['familyId']; }
unset($person);

$personCents = [];
foreach ($people as $person) $personCents[(int)$person['id']] = ['paid' => 0, 'consumed' => 0];
$dateSql = $throughDate === '' ? '' : ' AND e.expense_date<=?';
$expenses = api_rows(api_stmt("SELECT e.expense_id,e.amount,e.paid_by_user_id FROM tbl_trip_expense e WHERE e.trip_id=? AND e.is_deleted='1'" . $dateSql, $throughDate === '' ? 'i' : 'is', $throughDate === '' ? [$tripId] : [$tripId,$throughDate]));
$totalPaidCents = 0;
foreach ($expenses as $expense) {
    $expenseId = (int)$expense['expense_id'];
    $amountCents = (int)round((float)$expense['amount'] * 100);
    $payerId = (int)$expense['paid_by_user_id'];
    if (isset($personCents[$payerId])) $personCents[$payerId]['paid'] += $amountCents;
    $totalPaidCents += $amountCents;
    $splits = api_rows(api_stmt('SELECT user_id,share_amount FROM tbl_trip_expense_split WHERE expense_id=?', 'i', [$expenseId]));
    foreach ($splits as $split) {
        $splitUserId = (int)$split['user_id'];
        if (isset($personCents[$splitUserId])) $personCents[$splitUserId]['consumed'] += (int)round((float)$split['share_amount'] * 100);
    }
}

$personBalances = [];
$familyCents = [];
$familyMembers = [];
foreach ($families as $family) $familyCents[(int)$family['id']] = ['paid' => 0, 'consumed' => 0];
foreach ($people as $person) {
    $id = (int)$person['id'];
    $familyId = (int)$person['familyId'];
    $paid = $personCents[$id]['paid'] ?? 0;
    $consumed = $personCents[$id]['consumed'] ?? 0;
    $personBalance = [
        'userId' => (string)$id,
        'name' => $person['name'],
        'paid' => round($paid / 100, 2),
        'consumed' => round($consumed / 100, 2),
        'net' => round(($paid - $consumed) / 100, 2),
    ];
    $personBalances[] = $personBalance;
    $familyMembers[$familyId][] = $personBalance;
    if (isset($familyCents[$familyId])) {
        $familyCents[$familyId]['paid'] += $paid;
        $familyCents[$familyId]['consumed'] += $consumed;
    }
}

$familyBalances = [];
foreach ($families as $family) {
    $id = (int)$family['id'];
    $paid = $familyCents[$id]['paid'] ?? 0;
    $consumed = $familyCents[$id]['consumed'] ?? 0;
    $familyBalances[] = [
        'familyId' => (string)$id,
        'name' => $family['name'],
        'paid' => round($paid / 100, 2),
        'consumed' => round($consumed / 100, 2),
        'net' => round(($paid - $consumed) / 100, 2),
        'members' => $familyMembers[$id] ?? [],
    ];
}

$debtors = [];
$creditors = [];
foreach ($familyBalances as $family) {
    $netCents = (int)round((float)$family['net'] * 100);
    if ($netCents < 0) $debtors[] = ['id' => $family['familyId'], 'name' => $family['name'], 'cents' => -$netCents];
    if ($netCents > 0) $creditors[] = ['id' => $family['familyId'], 'name' => $family['name'], 'cents' => $netCents];
}
usort($debtors, fn($a,$b) => $b['cents'] <=> $a['cents']);
usort($creditors, fn($a,$b) => $b['cents'] <=> $a['cents']);
$settlements = [];
$debtorIndex = 0;
$creditorIndex = 0;
while ($debtorIndex < count($debtors) && $creditorIndex < count($creditors)) {
    $amountCents = min($debtors[$debtorIndex]['cents'], $creditors[$creditorIndex]['cents']);
    if ($amountCents > 0) $settlements[] = [
        'fromFamilyId' => $debtors[$debtorIndex]['id'],
        'fromFamilyName' => $debtors[$debtorIndex]['name'],
        'toFamilyId' => $creditors[$creditorIndex]['id'],
        'toFamilyName' => $creditors[$creditorIndex]['name'],
        'amount' => round($amountCents / 100, 2),
    ];
    $debtors[$debtorIndex]['cents'] -= $amountCents;
    $creditors[$creditorIndex]['cents'] -= $amountCents;
    if ($debtors[$debtorIndex]['cents'] === 0) $debtorIndex++;
    if ($creditors[$creditorIndex]['cents'] === 0) $creditorIndex++;
}

$netTotalCents = array_sum(array_map(fn($family) => (int)round((float)$family['net'] * 100), $familyBalances));
api_ok('Trip settlement loaded', ['data' => [
    'families' => $familyBalances,
    'people' => $personBalances,
    'settlements' => $settlements,
    'isBalanced' => $netTotalCents === 0,
    'totalPaid' => round($totalPaidCents / 100, 2),
]]);
