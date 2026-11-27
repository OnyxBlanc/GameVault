<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const RARITIES = ['commun', 'peu_commun', 'rare', 'epique', 'legendaire', 'mythique', 'ethere'];

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

function requireAdmin(PDO $pdo): int
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
    if ($uid === null) {
        reply(401, ['error' => 'unauthenticated']);
    }
    $st = $pdo->prepare('SELECT is_admin, banned FROM joueurs WHERE id = ?');
    $st->execute([$uid]);
    $row = $st->fetch();
    if (!$row || (int) $row['is_admin'] !== 1 || (int) $row['banned'] === 1) {
        reply(403, ['error' => 'forbidden']);
    }
    return $uid;
}

function body(): array
{
    $raw = file_get_contents('php://input', false, null, 0, 4097);
    if ($raw === false || strlen($raw) > 4096) {
        reply(413, ['error' => 'invalid_json']);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        reply(400, ['error' => 'invalid_json']);
    }
    return $data;
}

function logAction(PDO $pdo, int $adminId, string $action, ?string $target, ?string $details = null): void
{
    $pdo->prepare('INSERT INTO admin_logs (admin_id, action, cible, details) VALUES (?, ?, ?, ?)')
        ->execute([$adminId, $action, $target, $details]);
}

$pdo = null;

try {
    $action = isset($_GET['a']) && is_string($_GET['a']) ? $_GET['a'] : 'overview';
    $method = $_SERVER['REQUEST_METHOD'];
    $reads = ['overview', 'players', 'games'];
    $writes = ['player_update', 'player_moderate', 'player_clear_collection', 'player_clear_succes', 'game_rarity', 'game_delete', 'settings_save'];

    if (in_array($action, $reads, true)) {
        if ($method !== 'GET') {
            header('Allow: GET');
            reply(405, ['error' => 'method_not_allowed']);
        }
    } elseif (in_array($action, $writes, true)) {
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

    $pdo = db();
    $adminId = requireAdmin($pdo);

    switch ($action) {
        case 'overview':
            $stats = [
                'players' => (int) $pdo->query('SELECT COUNT(*) FROM joueurs')->fetchColumn(),
                'banned' => (int) $pdo->query('SELECT COUNT(*) FROM joueurs WHERE banned = 1 OR (timeout_until IS NOT NULL AND timeout_until > NOW())')->fetchColumn(),
                'games' => (int) $pdo->query('SELECT COUNT(*) FROM jeux')->fetchColumn(),
                'cards' => (int) $pdo->query('SELECT COALESCE(SUM(quantite), 0) FROM collections')->fetchColumn(),
            ];
            $settings = [];
            foreach ($pdo->query('SELECT cle, valeur FROM site_settings')->fetchAll() as $r) {
                $settings[$r['cle']] = $r['valeur'];
            }
            $logs = $pdo->query(
                'SELECT l.id, j.pseudo AS admin_pseudo, l.action, l.cible, l.details, l.cree_le
                 FROM admin_logs l
                 JOIN joueurs j ON j.id = l.admin_id
                 ORDER BY l.id DESC LIMIT 30'
            )->fetchAll();
            reply(200, ['stats' => $stats, 'settings' => $settings, 'logs' => $logs]);
            break;

        case 'players':
            $q = mb_substr(trim((string) ($_GET['q'] ?? '')), 0, 64);
            $where = $q !== '' ? 'WHERE j.pseudo LIKE ?' : '';
            $params = $q !== '' ? ['%' . addcslashes($q, '%_\\') . '%'] : [];
            $st = $pdo->prepare(
                "SELECT j.id, j.pseudo, j.credits, j.boosters_gratuits, j.starter_claimed, j.is_admin, j.banned, j.timeout_until, j.ban_reason,
                        (j.timeout_until IS NOT NULL AND j.timeout_until > NOW()) AS in_timeout,
                        (SELECT COUNT(*) FROM collections c WHERE c.joueur_id = j.id) AS uniques,
                        (SELECT COALESCE(SUM(c.quantite), 0) FROM collections c WHERE c.joueur_id = j.id) AS total_cards,
                        (SELECT COUNT(*) FROM joueur_succes s WHERE s.joueur_id = j.id) AS succes_count
                 FROM joueurs j
                 $where
                 ORDER BY j.id DESC
                 LIMIT 50"
            );
            $st->execute($params);
            $items = array_map(function ($r) {
                return [
                    'id' => (int) $r['id'],
                    'pseudo' => $r['pseudo'],
                    'credits' => (int) $r['credits'],
                    'boosters_gratuits' => (int) $r['boosters_gratuits'],
                    'starter_claimed' => (int) $r['starter_claimed'],
                    'is_admin' => (int) $r['is_admin'],
                    'banned' => (int) $r['banned'],
                    'in_timeout' => (int) $r['in_timeout'],
                    'timeout_until' => $r['timeout_until'],
                    'ban_reason' => $r['ban_reason'],
                    'uniques' => (int) $r['uniques'],
                    'total_cards' => (int) $r['total_cards'],
                    'succes_count' => (int) $r['succes_count'],
                ];
            }, $st->fetchAll());
            reply(200, ['items' => $items]);
            break;

        case 'player_update':
            $d = body();
            $id = (int) ($d['id'] ?? 0);
            if ($id < 1) {
                reply(422, ['error' => 'invalid_player']);
            }
            $credits = max(0, (int) ($d['credits'] ?? 0));
            $boosters = max(0, min(500, (int) ($d['boosters_gratuits'] ?? 0)));
            $starter = !empty($d['starter_claimed']) ? 1 : 0;
            $isAdmin = !empty($d['is_admin']) ? 1 : 0;
            if ($id === $adminId && $isAdmin === 0) {
                reply(422, ['error' => 'cannot_demote_self']);
            }
            $pdo->prepare('UPDATE joueurs SET credits = ?, boosters_gratuits = ?, starter_claimed = ?, is_admin = ? WHERE id = ?')
                ->execute([$credits, $boosters, $starter, $isAdmin, $id]);
            logAction($pdo, $adminId, 'player_update', "joueur#$id", "credits=$credits, boosters=$boosters, starter=$starter, admin=$isAdmin");
            reply(200, ['ok' => true]);
            break;

        case 'player_moderate':
            $d = body();
            $id = (int) ($d['id'] ?? 0);
            $mode = is_string($d['mode'] ?? null) ? $d['mode'] : '';
            $reason = mb_substr(trim((string) ($d['reason'] ?? '')), 0, 255);
            if ($id < 1 || $id === $adminId) {
                reply(422, ['error' => 'invalid_player']);
            }
            if ($mode === 'ban') {
                $pdo->prepare('UPDATE joueurs SET banned = 1, timeout_until = NULL, ban_reason = ? WHERE id = ?')
                    ->execute([$reason !== '' ? $reason : null, $id]);
                logAction($pdo, $adminId, 'ban', "joueur#$id", $reason);
            } elseif ($mode === 'timeout') {
                $minutes = max(1, min(43200, (int) ($d['minutes'] ?? 60)));
                $pdo->prepare('UPDATE joueurs SET banned = 0, timeout_until = DATE_ADD(NOW(), INTERVAL ? MINUTE), ban_reason = ? WHERE id = ?')
                    ->execute([$minutes, $reason !== '' ? $reason : null, $id]);
                logAction($pdo, $adminId, 'timeout', "joueur#$id", "{$minutes}m" . ($reason !== '' ? " · $reason" : ''));
            } elseif ($mode === 'unban') {
                $pdo->prepare('UPDATE joueurs SET banned = 0, timeout_until = NULL, ban_reason = NULL WHERE id = ?')
                    ->execute([$id]);
                logAction($pdo, $adminId, 'unban', "joueur#$id", null);
            } else {
                reply(422, ['error' => 'invalid_mode']);
            }
            reply(200, ['ok' => true]);
            break;

        case 'player_clear_collection':
            $d = body();
            $id = (int) ($d['id'] ?? 0);
            $gameId = (int) ($d['jeu_id'] ?? 0);
            if ($id < 1) {
                reply(422, ['error' => 'invalid_player']);
            }
            if ($gameId > 0) {
                $pdo->prepare('DELETE FROM collections WHERE joueur_id = ? AND jeu_id = ?')->execute([$id, $gameId]);
                logAction($pdo, $adminId, 'remove_card', "joueur#$id", "jeu#$gameId");
            } else {
                $pdo->prepare('DELETE FROM collections WHERE joueur_id = ?')->execute([$id]);
                logAction($pdo, $adminId, 'clear_collection', "joueur#$id", 'Collection vidée');
            }
            reply(200, ['ok' => true]);
            break;

        case 'player_clear_succes':
            $d = body();
            $id = (int) ($d['id'] ?? 0);
            $code = is_string($d['code'] ?? null) ? trim($d['code']) : '';
            if ($id < 1) {
                reply(422, ['error' => 'invalid_player']);
            }
            if ($code !== '') {
                $pdo->prepare('DELETE FROM joueur_succes WHERE joueur_id = ? AND code = ?')->execute([$id, $code]);
                logAction($pdo, $adminId, 'remove_succes', "joueur#$id", $code);
            } else {
                $pdo->prepare('DELETE FROM joueur_succes WHERE joueur_id = ?')->execute([$id]);
                logAction($pdo, $adminId, 'clear_succes', "joueur#$id", 'Succès réinitialisés');
            }
            reply(200, ['ok' => true]);
            break;

        case 'games':
            $q = mb_substr(trim((string) ($_GET['q'] ?? '')), 0, 100);
            $where = $q !== '' ? 'WHERE titre LIKE ?' : '';
            $params = $q !== '' ? ['%' . addcslashes($q, '%_\\') . '%'] : [];
            $st = $pdo->prepare("SELECT id, titre, date_sortie, rarete FROM jeux $where ORDER BY id DESC LIMIT 40");
            $st->execute($params);
            $items = array_map(fn($r) => [
                'id' => (int) $r['id'],
                'titre' => $r['titre'],
                'date_sortie' => $r['date_sortie'],
                'rarete' => $r['rarete'],
            ], $st->fetchAll());
            reply(200, ['items' => $items]);
            break;

        case 'game_rarity':
            $d = body();
            $id = (int) ($d['id'] ?? 0);
            $rarete = is_string($d['rarete'] ?? null) ? $d['rarete'] : '';
            if ($id < 1 || !in_array($rarete, RARITIES, true)) {
                reply(422, ['error' => 'invalid_params']);
            }
            $pdo->prepare('UPDATE jeux SET rarete = ? WHERE id = ?')->execute([$rarete, $id]);
            logAction($pdo, $adminId, 'game_rarity', "jeu#$id", $rarete);
            reply(200, ['ok' => true]);
            break;

        case 'game_delete':
            $d = body();
            $id = (int) ($d['id'] ?? 0);
            if ($id < 1) {
                reply(422, ['error' => 'invalid_params']);
            }
            $pdo->beginTransaction();
            $pdo->prepare('DELETE FROM collections WHERE jeu_id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM jeu_genres WHERE jeu_id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM jeux WHERE id = ?')->execute([$id]);
            $pdo->commit();
            logAction($pdo, $adminId, 'game_delete', "jeu#$id", null);
            reply(200, ['ok' => true]);
            break;

        case 'settings_save':
            $d = body();
            $marketEnabled = !empty($d['market_enabled']) ? '1' : '0';
            $marketFee = (string) max(0, min(50, (int) ($d['market_fee_pct'] ?? 5)));
            $maintenance = !empty($d['maintenance_mode']) ? '1' : '0';
            $up = $pdo->prepare('INSERT INTO site_settings (cle, valeur) VALUES (?, ?) ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)');
            $up->execute(['market_enabled', $marketEnabled]);
            $up->execute(['market_fee_pct', $marketFee]);
            $up->execute(['maintenance_mode', $maintenance]);
            logAction($pdo, $adminId, 'settings_save', 'site', "market=$marketEnabled, fee=$marketFee%, maintenance=$maintenance");
            reply(200, ['ok' => true]);
            break;
    }
} catch (Throwable $e) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('GameVault admin: ' . $e->getMessage());
    reply(500, ['error' => 'server_error']);
}
