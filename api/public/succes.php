<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const ACHIEVEMENTS = [
    ['code' => 'first_card', 'titre' => 'Premier pas', 'description' => 'Posséder au moins 1 jeu dans ta collection.', 'categorie' => 'Collection', 'metric' => 'uniques', 'cible' => 1, 'recompense' => 100],
    ['code' => 'col_10', 'titre' => 'Débutant', 'description' => 'Posséder 10 jeux différents.', 'categorie' => 'Collection', 'metric' => 'uniques', 'cible' => 10, 'recompense' => 150],
    ['code' => 'col_50', 'titre' => 'Amateur', 'description' => 'Posséder 50 jeux différents.', 'categorie' => 'Collection', 'metric' => 'uniques', 'cible' => 50, 'recompense' => 250],
    ['code' => 'col_100', 'titre' => 'Collectionneur', 'description' => 'Posséder 100 jeux différents.', 'categorie' => 'Collection', 'metric' => 'uniques', 'cible' => 100, 'recompense' => 400],
    ['code' => 'col_500', 'titre' => 'Archiviste', 'description' => 'Posséder 500 jeux différents.', 'categorie' => 'Collection', 'metric' => 'uniques', 'cible' => 500, 'recompense' => 800],
    ['code' => 'col_1000', 'titre' => 'Conservateur', 'description' => 'Posséder 1 000 jeux différents.', 'categorie' => 'Collection', 'metric' => 'uniques', 'cible' => 1000, 'recompense' => 1500],
    ['code' => 'cards_100', 'titre' => 'Chasseur de packs', 'description' => 'Accumuler 100 cartes au total.', 'categorie' => 'Volume', 'metric' => 'total', 'cible' => 100, 'recompense' => 200],
    ['code' => 'cards_500', 'titre' => 'Pile sans fin', 'description' => 'Accumuler 500 cartes au total.', 'categorie' => 'Volume', 'metric' => 'total', 'cible' => 500, 'recompense' => 500],
    ['code' => 'dupe_3', 'titre' => 'Jamais deux sans trois', 'description' => 'Posséder un même jeu en 3 exemplaires.', 'categorie' => 'Volume', 'metric' => 'max_dupe', 'cible' => 3, 'recompense' => 150],
    ['code' => 'dupe_5', 'titre' => 'Fan absolu', 'description' => 'Posséder un même jeu en 5 exemplaires.', 'categorie' => 'Volume', 'metric' => 'max_dupe', 'cible' => 5, 'recompense' => 300],
    ['code' => 'rar_rare', 'titre' => 'Touche bleue', 'description' => 'Obtenir au moins une carte Rare.', 'categorie' => 'Raretés', 'metric' => 'r_rare', 'cible' => 1, 'recompense' => 100],
    ['code' => 'rar_epique', 'titre' => 'Éclat violet', 'description' => 'Obtenir au moins une carte Épique.', 'categorie' => 'Raretés', 'metric' => 'r_epique', 'cible' => 1, 'recompense' => 200],
    ['code' => 'rar_legendaire', 'titre' => 'Légende vivante', 'description' => 'Obtenir au moins une carte Légendaire.', 'categorie' => 'Raretés', 'metric' => 'r_legendaire', 'cible' => 1, 'recompense' => 400],
    ['code' => 'rar_mythique', 'titre' => 'Mythe', 'description' => 'Obtenir au moins une carte Mythique.', 'categorie' => 'Raretés', 'metric' => 'r_mythique', 'cible' => 1, 'recompense' => 1000],
    ['code' => 'rar_ethere', 'titre' => 'Touché par l’Éther', 'description' => 'Obtenir au moins une carte Éthérée.', 'categorie' => 'Raretés', 'metric' => 'r_ethere', 'cible' => 1, 'recompense' => 2500],
    ['code' => 'genres_10', 'titre' => 'Touche-à-tout', 'description' => 'Posséder des jeux dans 10 genres différents.', 'categorie' => 'Diversité', 'metric' => 'genres', 'cible' => 10, 'recompense' => 300],
];

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
    $uid = isset($_SESSION['uid']) ? (int) $_SESSION['uid'] : null;
    session_write_close();
    return $uid;
}

function metrics(PDO $pdo, int $uid): array
{
    $st = $pdo->prepare(
        "SELECT COUNT(*) AS uniques,
                COALESCE(SUM(c.quantite), 0) AS total,
                COALESCE(MAX(c.quantite), 0) AS max_dupe,
                COALESCE(SUM(j.rarete = 'rare'), 0) AS r_rare,
                COALESCE(SUM(j.rarete = 'epique'), 0) AS r_epique,
                COALESCE(SUM(j.rarete = 'legendaire'), 0) AS r_legendaire,
                COALESCE(SUM(j.rarete = 'mythique'), 0) AS r_mythique,
                COALESCE(SUM(j.rarete = 'ethere'), 0) AS r_ethere
         FROM collections c
         JOIN jeux j ON j.id = c.jeu_id
         WHERE c.joueur_id = ?"
    );
    $st->execute([$uid]);
    $row = $st->fetch() ?: [];

    $st2 = $pdo->prepare(
        'SELECT COUNT(DISTINCT jg.genre_id)
         FROM collections c
         JOIN jeu_genres jg ON jg.jeu_id = c.jeu_id
         WHERE c.joueur_id = ?'
    );
    $st2->execute([$uid]);
    $genres = (int) $st2->fetchColumn();

    return [
        'uniques' => (int) ($row['uniques'] ?? 0),
        'total' => (int) ($row['total'] ?? 0),
        'max_dupe' => (int) ($row['max_dupe'] ?? 0),
        'r_rare' => (int) ($row['r_rare'] ?? 0),
        'r_epique' => (int) ($row['r_epique'] ?? 0),
        'r_legendaire' => (int) ($row['r_legendaire'] ?? 0),
        'r_mythique' => (int) ($row['r_mythique'] ?? 0),
        'r_ethere' => (int) ($row['r_ethere'] ?? 0),
        'genres' => $genres,
    ];
}

function syncAndBuild(PDO $pdo, int $uid): array
{
    $m = metrics($pdo, $uid);
    $ins = $pdo->prepare('INSERT IGNORE INTO joueur_succes (joueur_id, code) VALUES (?, ?)');
    foreach (ACHIEVEMENTS as $a) {
        if (($m[$a['metric']] ?? 0) >= $a['cible']) {
            $ins->execute([$uid, $a['code']]);
        }
    }

    $st = $pdo->prepare('SELECT code, debloque_le, recompense_reclamee FROM joueur_succes WHERE joueur_id = ?');
    $st->execute([$uid]);
    $saved = [];
    foreach ($st->fetchAll() as $row) {
        $saved[$row['code']] = $row;
    }

    $items = [];
    $unlocked = 0;
    $claimable = 0;
    foreach (ACHIEVEMENTS as $a) {
        $val = min($a['cible'], $m[$a['metric']] ?? 0);
        $done = isset($saved[$a['code']]);
        $claimed = $done && (int) $saved[$a['code']]['recompense_reclamee'] === 1;
        if ($done) {
            $unlocked++;
            if (!$claimed) {
                $claimable++;
            }
        }
        $items[] = [
            'code' => $a['code'],
            'titre' => $a['titre'],
            'description' => $a['description'],
            'categorie' => $a['categorie'],
            'progression' => $done ? $a['cible'] : $val,
            'cible' => $a['cible'],
            'recompense' => $a['recompense'],
            'debloque' => $done,
            'reclame' => $claimed,
            'debloque_le' => $done ? $saved[$a['code']]['debloque_le'] : null,
        ];
    }
    return ['items' => $items, 'unlocked' => $unlocked, 'total' => count(ACHIEVEMENTS), 'claimable' => $claimable];
}

$pdo = null;

try {
    $action = isset($_GET['a']) && is_string($_GET['a']) ? $_GET['a'] : 'list';
    $method = $_SERVER['REQUEST_METHOD'];

    if ($action === 'list') {
        if ($method !== 'GET') {
            header('Allow: GET');
            reply(405, ['error' => 'method_not_allowed']);
        }
    } elseif ($action === 'claim') {
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

    $uid = userId();
    if ($uid === null) {
        reply(401, ['error' => 'unauthenticated']);
    }

    $pdo = db();

    if ($action === 'list') {
        reply(200, syncAndBuild($pdo, $uid));
    }

    $raw = file_get_contents('php://input', false, null, 0, 1025);
    $body = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($body)) {
        reply(400, ['error' => 'invalid_json']);
    }
    $claimAll = !empty($body['all']);
    $targetCode = is_string($body['code'] ?? null) ? $body['code'] : '';

    $rewardsByCode = [];
    foreach (ACHIEVEMENTS as $a) {
        $rewardsByCode[$a['code']] = $a['recompense'];
    }
    if (!$claimAll && !isset($rewardsByCode[$targetCode])) {
        reply(422, ['error' => 'invalid_code']);
    }

    $pdo->beginTransaction();
    $m = metrics($pdo, $uid);
    $ins = $pdo->prepare('INSERT IGNORE INTO joueur_succes (joueur_id, code) VALUES (?, ?)');
    foreach (ACHIEVEMENTS as $a) {
        if (($m[$a['metric']] ?? 0) >= $a['cible']) {
            $ins->execute([$uid, $a['code']]);
        }
    }

    if ($claimAll) {
        $st = $pdo->prepare('SELECT code FROM joueur_succes WHERE joueur_id = ? AND recompense_reclamee = 0 FOR UPDATE');
        $st->execute([$uid]);
    } else {
        $st = $pdo->prepare('SELECT code FROM joueur_succes WHERE joueur_id = ? AND code = ? AND recompense_reclamee = 0 FOR UPDATE');
        $st->execute([$uid, $targetCode]);
    }
    $codes = $st->fetchAll(PDO::FETCH_COLUMN);

    $reward = 0;
    foreach ($codes as $c) {
        $reward += $rewardsByCode[$c] ?? 0;
    }

    if ($codes) {
        $marks = implode(',', array_fill(0, count($codes), '?'));
        $upd = $pdo->prepare("UPDATE joueur_succes SET recompense_reclamee = 1 WHERE joueur_id = ? AND code IN ($marks)");
        $upd->execute(array_merge([$uid], $codes));
        if ($reward > 0) {
            $pdo->prepare('UPDATE joueurs SET credits = credits + ? WHERE id = ?')->execute([$reward, $uid]);
        }
    }

    $stCred = $pdo->prepare('SELECT credits FROM joueurs WHERE id = ?');
    $stCred->execute([$uid]);
    $credits = (int) $stCred->fetchColumn();
    $pdo->commit();

    $payload = syncAndBuild($pdo, $uid);
    $payload['claimed'] = count($codes);
    $payload['reward'] = $reward;
    $payload['credits'] = $credits;
    reply(200, $payload);
} catch (Throwable $e) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('GameVault succes: ' . $e->getMessage());
    reply(500, ['error' => 'server_error']);
}
