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

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        header('Allow: GET');
        reply(405, ['error' => 'method_not_allowed']);
    }
    $id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
    if ($id === false || $id === null || $id < 1) {
        reply(422, ['error' => 'invalid_id']);
    }

    $pdo = db();
    $st = $pdo->prepare('SELECT rarete FROM jeux WHERE id = ?');
    $st->execute([$id]);
    $rarete = $st->fetchColumn();
    if ($rarete === false) {
        reply(404, ['error' => 'not_found']);
    }

    $st = $pdo->prepare('SELECT COALESCE(SUM(quantite), 0) AS total, COUNT(*) AS owners FROM collections WHERE jeu_id = ?');
    $st->execute([$id]);
    $row = $st->fetch();

    $mine = null;
    if (isset($_COOKIE['gv_session'])) {
        session_name('gv_session');
        session_start();
        $uid = $_SESSION['uid'] ?? null;
        session_write_close();
        if ($uid !== null) {
            $st = $pdo->prepare('SELECT quantite FROM collections WHERE joueur_id = ? AND jeu_id = ?');
            $st->execute([(int) $uid, $id]);
            $value = $st->fetchColumn();
            $mine = $value === false ? 0 : (int) $value;
        }
    }

    reply(200, [
        'id' => $id,
        'rarete' => $rarete,
        'total' => (int) $row['total'],
        'proprietaires' => (int) $row['owners'],
        'mine' => $mine,
    ]);
} catch (Throwable $e) {
    error_log('GameVault carte: ' . $e->getMessage());
    reply(500, ['error' => 'server_error']);
}
