<?php
declare(strict_types=1);

const PRICE = 100;
const COUNT = 5;
const MAX_FREE = 50;
const INTERVAL = 300;
const ODDS = [
    ['ethere', 100],
    ['mythique', 900],
    ['legendaire', 10000],
    ['epique', 40000],
    ['rare', 100000],
    ['peu_commun', 250000],
    ['commun', 599000],
];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function reply(int $code, array $data): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function db(): PDO
{
    $file = __DIR__ . '/config.local.php';
    if (!is_file($file)) {
        throw new RuntimeException('Missing database config');
    }
    $c = require $file;
    return new PDO(
        'mysql:host=' . $c['host'] . ';dbname=' . $c['database'] . ';charset=utf8mb4',
        $c['user'],
        $c['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
}

function userId(): ?int
{
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_name('gv_session');
    session_start();
    return isset($_SESSION['uid']) ? (int) $_SESSION['uid'] : null;
}

function syncFree(PDO $pdo, int $id): ?array
{
    $st = $pdo->prepare('SELECT pseudo, credits, boosters_gratuits, UNIX_TIMESTAMP(boosters_maj) AS last, UNIX_TIMESTAMP() AS now FROM joueurs WHERE id = ? FOR UPDATE');
    $st->execute([$id]);
    $r = $st->fetch();
    if (!$r) {
        return null;
    }
    $stock = (int) $r['boosters_gratuits'];
    $last = (int) $r['last'];
    $now = (int) $r['now'];
    if ($stock >= MAX_FREE) {
        $stock = MAX_FREE;
        $last = $now;
    } else {
        $gain = intdiv(max(0, $now - $last), INTERVAL);
        if ($gain > 0) {
            $stock = min(MAX_FREE, $stock + $gain);
            $last = $stock >= MAX_FREE ? $now : $last + $gain * INTERVAL;
        }
    }
    return ['pseudo' => $r['pseudo'], 'credits' => (int) $r['credits'], 'free' => $stock, 'last' => $last, 'now' => $now];
}

function saveState(PDO $pdo, int $id, array $s): void
{
    $pdo->prepare('UPDATE joueurs SET credits = ?, boosters_gratuits = ?, boosters_maj = FROM_UNIXTIME(?) WHERE id = ?')
        ->execute([$s['credits'], $s['free'], $s['last'], $id]);
}

function publicState(array $s): array
{
    $next = $s['free'] >= MAX_FREE ? 0 : max(1, INTERVAL - ($s['now'] - $s['last']));
    return [
        'pseudo' => $s['pseudo'],
        'credits' => $s['credits'],
        'free' => $s['free'],
        'max_free' => MAX_FREE,
        'next_in' => $next,
        'price' => PRICE,
        'count' => COUNT,
    ];
}

function pickFrom(PDO $pdo, string $rarity): ?int
{
    $st = $pdo->prepare('SELECT COUNT(*) FROM jeux WHERE rarete = ?');
    $st->execute([$rarity]);
    $n = (int) $st->fetchColumn();
    if ($n < 1) {
        return null;
    }
    $offset = random_int(0, $n - 1);
    $st = $pdo->prepare("SELECT id FROM jeux WHERE rarete = ? ORDER BY id LIMIT 1 OFFSET $offset");
    $st->execute([$rarity]);
    $id = $st->fetchColumn();
    return $id === false ? null : (int) $id;
}

function drawGame(PDO $pdo): int
{
    $roll = random_int(1, 1000000);
    $start = count(ODDS) - 1;
    $acc = 0;
    foreach (ODDS as $i => $odd) {
        $acc += $odd[1];
        if ($roll <= $acc) {
            $start = $i;
            break;
        }
    }
    for ($i = $start; $i < count(ODDS); $i++) {
        $id = pickFrom($pdo, ODDS[$i][0]);
        if ($id !== null) {
            return $id;
        }
    }
    for ($i = $start - 1; $i >= 0; $i--) {
        $id = pickFrom($pdo, ODDS[$i][0]);
        if ($id !== null) {
            return $id;
        }
    }
    throw new RuntimeException('No game available');
}

$pdo = null;

try {
    $action = isset($_GET['a']) && is_string($_GET['a']) ? $_GET['a'] : 'status';
    $method = $_SERVER['REQUEST_METHOD'];
    if ($action === 'status') {
        if ($method !== 'GET') {
            header('Allow: GET');
            reply(405, ['error' => 'method_not_allowed']);
        }
    } elseif ($action === 'open') {
        if ($method !== 'POST') {
            header('Allow: POST');
            reply(405, ['error' => 'method_not_allowed']);
        }
        if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'GameVault') {
            reply(403, ['error' => 'forbidden']);
        }
    } else {
        reply(404, ['error' => 'not_found']);
    }

    $mode = '';
    if ($action === 'open') {
        $raw = file_get_contents('php://input', false, null, 0, 1025);
        $data = json_decode($raw === false ? '' : $raw, true);
        $mode = is_array($data) && is_string($data['mode'] ?? null) ? $data['mode'] : '';
        if ($mode !== 'free' && $mode !== 'paid') {
            reply(422, ['error' => 'invalid_mode']);
        }
    }

    $pdo = db();
    $id = userId();
    if ($id === null) {
        reply(401, ['error' => 'unauthenticated']);
    }

    $pdo->beginTransaction();
    $s = syncFree($pdo, $id);
    if ($s === null) {
        $pdo->rollBack();
        reply(401, ['error' => 'unauthenticated']);
    }

    if ($action === 'status') {
        saveState($pdo, $id, $s);
        $pdo->commit();
        reply(200, publicState($s));
    }

    if ($mode === 'free' && $s['free'] < 1) {
        saveState($pdo, $id, $s);
        $pdo->commit();
        reply(409, ['error' => 'no_free_booster']);
    }
    if ($mode === 'paid' && $s['credits'] < PRICE) {
        saveState($pdo, $id, $s);
        $pdo->commit();
        reply(402, ['error' => 'insufficient_credits']);
    }

    $total = (int) $pdo->query('SELECT COUNT(*) FROM jeux')->fetchColumn();
    if ($total < 1) {
        saveState($pdo, $id, $s);
        $pdo->commit();
        reply(503, ['error' => 'catalogue_empty']);
    }

    if ($mode === 'free') {
        $s['free'] -= 1;
    } else {
        $s['credits'] -= PRICE;
    }

    $ids = [];
    for ($i = 0; $i < COUNT; $i++) {
        $ids[] = drawGame($pdo);
    }
    $add = $pdo->prepare('INSERT INTO collections (joueur_id, jeu_id, quantite) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE quantite = quantite + 1');
    foreach ($ids as $gameId) {
        $add->execute([$id, $gameId]);
    }
    saveState($pdo, $id, $s);
    $pdo->commit();

    $counts = array_count_values($ids);
    $marks = implode(',', array_fill(0, count($counts), '?'));
    $st = $pdo->prepare('SELECT j.id, j.titre, j.date_sortie, j.image_url, j.rarete, (SELECT GROUP_CONCAT(g.nom ORDER BY g.nom) FROM jeu_genres jg JOIN genres g ON g.id = jg.genre_id WHERE jg.jeu_id = j.id) AS genres FROM jeux j WHERE j.id IN (' . $marks . ') ORDER BY j.titre');
    $st->execute(array_keys($counts));
    $items = [];
    foreach ($st->fetchAll() as $row) {
        $row['id'] = (int) $row['id'];
        $row['genres'] = ($row['genres'] ?? '') === '' ? [] : explode(',', $row['genres']);
        $row['obtenu'] = $counts[$row['id']] ?? 1;
        $items[] = $row;
    }
    reply(200, ['items' => $items, 'state' => publicState($s)]);
} catch (Throwable $e) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('GameVault booster: ' . $e->getMessage());
    reply(500, ['error' => 'server_error']);
}
