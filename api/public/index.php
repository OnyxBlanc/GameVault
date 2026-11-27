<?php
declare(strict_types=1);

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

function startSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
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
}

function currentUserId(): ?int
{
    startSession();
    return isset($_SESSION['uid']) ? (int) $_SESSION['uid'] : null;
}

function requireUser(): int
{
    $id = currentUserId();
    if ($id === null) {
        reply(401, ['error' => 'unauthenticated']);
    }
    return $id;
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

function userPayload(PDO $pdo, int $id): ?array
{
    $st = $pdo->prepare('SELECT pseudo, credits, starter_claimed, is_admin, banned, timeout_until, ban_reason, (timeout_until IS NOT NULL AND timeout_until > NOW()) AS in_timeout FROM joueurs WHERE id = ?');
    $st->execute([$id]);
    $row = $st->fetch();
    if (!$row) {
        return null;
    }
    if ((int) $row['banned'] === 1 || (int) $row['in_timeout'] === 1) {
        return null;
    }
    return [
        'pseudo' => $row['pseudo'],
        'credits' => (int) $row['credits'],
        'starter_claimed' => (int) $row['starter_claimed'],
        'is_admin' => (int) $row['is_admin'],
    ];
}

function genresSql(): string
{
    return '(SELECT GROUP_CONCAT(g.nom ORDER BY g.nom SEPARATOR \'|\') FROM jeu_genres jg JOIN genres g ON g.id = jg.genre_id WHERE jg.jeu_id = j.id)';
}

function withGenres(array $row): array
{
    $row['id'] = (int) $row['id'];
    $row['genres'] = ($row['genres'] ?? '') === '' || $row['genres'] === null ? [] : explode('|', $row['genres']);
    if (isset($row['quantite'])) {
        $row['quantite'] = (int) $row['quantite'];
    }
    return $row;
}

function orderSql(string $sort): string
{
    $rank = "FIELD(j.rarete, 'commun', 'peu_commun', 'rare', 'epique', 'legendaire', 'mythique', 'ethere')";
    switch ($sort) {
        case 'nom_desc':
            return 'j.titre DESC, j.id';
        case 'rarete_desc':
            return "$rank DESC, j.titre, j.id";
        case 'rarete_asc':
            return "$rank, j.titre, j.id";
        default:
            return 'j.titre, j.id';
    }
}

function listGames(PDO $pdo, string $q, int $genre, int $page, ?int $owner, string $sort): array
{
    $per = 24;
    $join = $owner !== null ? 'JOIN collections c ON c.jeu_id = j.id AND c.joueur_id = ?' : '';
    $where = [];
    $wParams = [];
    if ($q !== '') {
        $where[] = 'j.titre LIKE ?';
        $wParams[] = '%' . addcslashes($q, '%_\\') . '%';
    }
    if ($genre > 0) {
        $where[] = 'EXISTS (SELECT 1 FROM jeu_genres x WHERE x.jeu_id = j.id AND x.genre_id = ?)';
        $wParams[] = $genre;
    }
    $sqlWhere = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $params = $owner !== null ? array_merge([$owner], $wParams) : $wParams;

    $st = $pdo->prepare("SELECT COUNT(*) FROM jeux j $join $sqlWhere");
    $st->execute($params);
    $total = (int) $st->fetchColumn();

    $offset = ($page - 1) * $per;
    $qty = $owner !== null ? ', c.quantite' : '';
    $order = orderSql($sort);
    $sql = 'SELECT j.id, j.titre, j.date_sortie, j.image_url, j.rarete' . $qty . ', ' . genresSql() . " AS genres FROM jeux j $join $sqlWhere ORDER BY $order LIMIT $per OFFSET $offset";
    $st = $pdo->prepare($sql);
    $st->execute($params);

    return [
        'items' => array_map('withGenres', $st->fetchAll()),
        'page' => $page,
        'pages' => max(1, (int) ceil($total / $per)),
        'total' => $total,
    ];
}

$pdo = null;
$action = isset($_GET['a']) && is_string($_GET['a']) ? $_GET['a'] : 'health';

try {
    $reads = ['health', 'genres', 'catalogue', 'me', 'collection'];
    $writes = ['register', 'login', 'logout', 'starter'];
    $method = $_SERVER['REQUEST_METHOD'];

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

    switch ($action) {
        case 'health':
            $pdo->query('SELECT id FROM jeux LIMIT 1');
            reply(200, ['status' => 'ok']);
            break;

        case 'genres':
            header('Cache-Control: private, max-age=300');
            $rows = $pdo->query('SELECT id, nom FROM genres ORDER BY nom')->fetchAll();
            reply(200, ['items' => array_map(fn($r) => ['id' => (int) $r['id'], 'nom' => $r['nom']], $rows)]);
            break;

        case 'catalogue':
            header('Cache-Control: private, max-age=60');
            $q = mb_substr(trim((string) ($_GET['q'] ?? '')), 0, 100);
            $genre = (int) ($_GET['genre'] ?? 0);
            $page = min(100000, max(1, (int) ($_GET['page'] ?? 1)));
            $sort = is_string($_GET['sort'] ?? null) ? $_GET['sort'] : '';
            reply(200, listGames($pdo, $q, $genre, $page, null, $sort));
            break;

        case 'me':
            $id = currentUserId();
            $user = $id === null ? null : userPayload($pdo, $id);
            if ($id !== null && $user === null) {
                $_SESSION = [];
            }
            reply(200, ['user' => $user]);
            break;

        case 'collection':
            $id = requireUser();
            $q = mb_substr(trim((string) ($_GET['q'] ?? '')), 0, 100);
            $genre = (int) ($_GET['genre'] ?? 0);
            $page = min(100000, max(1, (int) ($_GET['page'] ?? 1)));
            $sort = is_string($_GET['sort'] ?? null) ? $_GET['sort'] : '';
            reply(200, listGames($pdo, $q, $genre, $page, $id, $sort));
            break;

        case 'register':
            $d = body();
            $email = is_string($d['email'] ?? null) ? mb_strtolower(trim($d['email'])) : '';
            $pseudo = is_string($d['pseudo'] ?? null) ? trim($d['pseudo']) : '';
            $password = is_string($d['password'] ?? null) ? $d['password'] : '';
            if ($email === '' || strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                reply(422, ['error' => 'invalid_email']);
            }
            if (!preg_match('/^[A-Za-z0-9_-]{3,32}$/', $pseudo)) {
                reply(422, ['error' => 'invalid_pseudo']);
            }
            if (strlen($password) < 8 || strlen($password) > 200) {
                reply(422, ['error' => 'invalid_password']);
            }
            try {
                $st = $pdo->prepare('INSERT INTO joueurs (pseudo, email, password_hash) VALUES (?, ?, ?)');
                $st->execute([$pseudo, $email, password_hash($password, PASSWORD_DEFAULT)]);
            } catch (PDOException $e) {
                if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
                    $msg = $e->getMessage();
                    reply(409, ['error' => str_contains($msg, 'email') ? 'email_taken' : 'pseudo_taken']);
                }
                throw $e;
            }
            $id = (int) $pdo->lastInsertId();
            startSession();
            session_regenerate_id(true);
            $_SESSION['uid'] = $id;
            reply(201, ['user' => userPayload($pdo, $id)]);
            break;

        case 'login':
            $d = body();
            $pseudo = is_string($d['pseudo'] ?? null) ? trim($d['pseudo']) : '';
            $password = is_string($d['password'] ?? null) ? $d['password'] : '';
            $st = $pdo->prepare('SELECT id, password_hash, banned, timeout_until, ban_reason, (timeout_until IS NOT NULL AND timeout_until > NOW()) AS in_timeout FROM joueurs WHERE pseudo = ?');
            $st->execute([$pseudo]);
            $row = $st->fetch();
            if (!$row || !password_verify($password, $row['password_hash'])) {
                reply(401, ['error' => 'invalid_credentials']);
            }
            if ((int) $row['banned'] === 1) {
                reply(403, ['error' => 'banned', 'reason' => $row['ban_reason']]);
            }
            if ((int) $row['in_timeout'] === 1) {
                reply(403, ['error' => 'timeout', 'until' => $row['timeout_until'], 'reason' => $row['ban_reason']]);
            }
            startSession();
            session_regenerate_id(true);
            $_SESSION['uid'] = (int) $row['id'];
            reply(200, ['user' => userPayload($pdo, (int) $row['id'])]);
            break;

        case 'logout':
            startSession();
            $_SESSION = [];
            session_destroy();
            reply(200, ['ok' => true]);
            break;

        case 'starter':
            $id = requireUser();
            $pdo->beginTransaction();
            $st = $pdo->prepare('SELECT starter_claimed FROM joueurs WHERE id = ? FOR UPDATE');
            $st->execute([$id]);
            $claimed = $st->fetchColumn();
            if ($claimed === false) {
                $pdo->rollBack();
                reply(401, ['error' => 'unauthenticated']);
            }
            if ((int) $claimed === 1) {
                $pdo->rollBack();
                reply(409, ['error' => 'already_claimed']);
            }
            $total = (int) $pdo->query('SELECT COUNT(*) FROM jeux')->fetchColumn();
            if ($total < 1) {
                $pdo->rollBack();
                reply(503, ['error' => 'catalogue_empty']);
            }
            $ids = [];
            for ($i = 0; $i < 5; $i++) {
                $offset = random_int(0, $total - 1);
                $ids[] = (int) $pdo->query("SELECT id FROM jeux ORDER BY id LIMIT 1 OFFSET $offset")->fetchColumn();
            }
            $add = $pdo->prepare('INSERT INTO collections (joueur_id, jeu_id, quantite) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE quantite = quantite + 1');
            foreach ($ids as $gameId) {
                $add->execute([$id, $gameId]);
            }
            $pdo->prepare('UPDATE joueurs SET starter_claimed = 1 WHERE id = ?')->execute([$id]);
            $pdo->commit();

            $counts = array_count_values($ids);
            $marks = implode(',', array_fill(0, count($counts), '?'));
            $st = $pdo->prepare('SELECT j.id, j.titre, j.date_sortie, j.image_url, j.rarete, ' . genresSql() . " AS genres FROM jeux j WHERE j.id IN ($marks) ORDER BY j.titre");
            $st->execute(array_keys($counts));
            $items = array_map(function ($row) use ($counts) {
                $row = withGenres($row);
                $row['obtenu'] = $counts[$row['id']] ?? 1;
                return $row;
            }, $st->fetchAll());
            reply(200, ['items' => $items, 'user' => userPayload($pdo, $id)]);
            break;
    }
} catch (Throwable $e) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('GameVault: ' . $e->getMessage());
    if ($action === 'health') {
        reply(503, ['error' => 'service_unavailable']);
    }
    reply(500, ['error' => 'server_error']);
}
