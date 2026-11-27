<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const ALLOWED_FRAMES = ['auto', 'or', 'mythique', 'ethere', 'sakura', 'neon'];
const ALLOWED_PSEUDO_STYLES = ['default', 'sakura', 'ocean', 'braise', 'or', 'prisme', 'aurore'];
const ALLOWED_THEMES = ['none', 'sakura', 'nuit', 'ocean', 'braise', 'jade', 'or'];
const ALLOWED_SHOWCASE = ['projecteur', 'classeur'];
const ALLOWED_PRIVACY = ['public', 'private'];

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

function currentUserId(): ?int
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

try {
    $action = isset($_GET['a']) && is_string($_GET['a']) ? $_GET['a'] : 'view';
    $method = $_SERVER['REQUEST_METHOD'];

    if ($action === 'view') {
        if ($method !== 'GET') {
            reply(405, ['error' => 'method_not_allowed']);
        }
    } elseif ($action === 'save' || $action === 'showcase') {
        if ($method !== 'POST') {
            reply(405, ['error' => 'method_not_allowed']);
        }
        if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'GameVault') {
            reply(403, ['error' => 'forbidden']);
        }
    } else {
        reply(404, ['error' => 'not_found']);
    }

    $pdo = db();
    $viewerId = currentUserId();

    if ($action === 'view') {
        $pseudo = is_string($_GET['pseudo'] ?? null) ? trim($_GET['pseudo']) : '';
        if ($pseudo !== '') {
            $st = $pdo->prepare('SELECT id, pseudo, cree_le, bio, avatar_url, avatar_frame, titre, pseudo_style, profile_theme, showcase_style, showcase_ids, privacy_profile, privacy_collection FROM joueurs WHERE pseudo = ?');
            $st->execute([$pseudo]);
        } else {
            if ($viewerId === null) {
                reply(401, ['error' => 'unauthenticated']);
            }
            $st = $pdo->prepare('SELECT id, pseudo, cree_le, bio, avatar_url, avatar_frame, titre, pseudo_style, profile_theme, showcase_style, showcase_ids, privacy_profile, privacy_collection FROM joueurs WHERE id = ?');
            $st->execute([$viewerId]);
        }
        $row = $st->fetch();
        if (!$row) {
            reply(404, ['error' => 'not_found']);
        }
        $targetId = (int) $row['id'];
        $isSelf = $viewerId !== null && $viewerId === $targetId;
        $isPrivate = !$isSelf && $row['privacy_profile'] === 'private';

        $catalogueTotal = (int) $pdo->query('SELECT COUNT(*) FROM jeux')->fetchColumn();
        $stStats = $pdo->prepare(
            "SELECT COUNT(*) AS uniques,
                    COALESCE(SUM(c.quantite), 0) AS total_cards,
                    SUM(CASE WHEN j.rarete = 'mythique' THEN 1 ELSE 0 END) AS mythiques,
                    SUM(CASE WHEN j.rarete = 'ethere' THEN 1 ELSE 0 END) AS etheres
             FROM collections c JOIN jeux j ON j.id = c.jeu_id WHERE c.joueur_id = ?"
        );
        $stStats->execute([$targetId]);
        $statsRow = $stStats->fetch() ?: [];
        $stSuc = $pdo->prepare('SELECT COUNT(*) FROM joueur_succes WHERE joueur_id = ?');
        $stSuc->execute([$targetId]);
        $succesCount = (int) $stSuc->fetchColumn();

        $showcase = [];
        if (!$isPrivate) {
            $ids = array_values(array_filter(array_map('intval', explode(',', (string) ($row['showcase_ids'] ?? ''))), fn($v) => $v > 0));
            if ($ids) {
                $ids = array_slice(array_unique($ids), 0, 7);
                $marks = implode(',', array_fill(0, count($ids), '?'));
                $stCards = $pdo->prepare(
                    "SELECT j.id, j.titre, j.image_url, j.rarete, j.date_sortie
                     FROM collections c JOIN jeux j ON j.id = c.jeu_id
                     WHERE c.joueur_id = ? AND j.id IN ($marks)"
                );
                $stCards->execute(array_merge([$targetId], $ids));
                $byId = [];
                foreach ($stCards->fetchAll() as $c) {
                    $byId[(int) $c['id']] = [
                        'id' => (int) $c['id'],
                        'titre' => $c['titre'],
                        'image_url' => $c['image_url'],
                        'rarete' => $c['rarete'],
                        'date_sortie' => $c['date_sortie'],
                    ];
                }
                foreach ($ids as $cid) {
                    if (isset($byId[$cid])) {
                        $showcase[] = $byId[$cid];
                    }
                }
            }
        }

        reply(200, [
            'is_self' => $isSelf,
            'is_private' => $isPrivate,
            'profile' => [
                'pseudo' => $row['pseudo'],
                'cree_le' => $row['cree_le'],
                'bio' => $isPrivate ? null : $row['bio'],
                'avatar_url' => $row['avatar_url'],
                'avatar_frame' => $row['avatar_frame'],
                'titre' => $row['titre'],
                'pseudo_style' => $row['pseudo_style'],
                'profile_theme' => $row['profile_theme'],
                'showcase_style' => $row['showcase_style'],
                'privacy_profile' => $row['privacy_profile'],
                'privacy_collection' => $row['privacy_collection'],
            ],
            'stats' => $isPrivate ? null : [
                'uniques' => (int) ($statsRow['uniques'] ?? 0),
                'catalogue' => $catalogueTotal,
                'total_cards' => (int) ($statsRow['total_cards'] ?? 0),
                'mythiques' => (int) ($statsRow['mythiques'] ?? 0),
                'etheres' => (int) ($statsRow['etheres'] ?? 0),
                'succes' => $succesCount,
            ],
            'showcase' => $showcase,
        ]);
    }

    if ($viewerId === null) {
        reply(401, ['error' => 'unauthenticated']);
    }

    if ($action === 'save') {
        $d = body();
        $bio = mb_substr(trim((string) ($d['bio'] ?? '')), 0, 160);
        $avatar = trim((string) ($d['avatar_url'] ?? ''));
        if ($avatar !== '' && (!str_starts_with($avatar, 'https://') || strlen($avatar) > 500)) {
            reply(422, ['error' => 'invalid_avatar']);
        }
        $titre = mb_substr(trim((string) ($d['titre'] ?? '')), 0, 64);
        $frame = in_array($d['avatar_frame'] ?? '', ALLOWED_FRAMES, true) ? $d['avatar_frame'] : 'auto';
        $pStyle = in_array($d['pseudo_style'] ?? '', ALLOWED_PSEUDO_STYLES, true) ? $d['pseudo_style'] : 'default';
        $theme = in_array($d['profile_theme'] ?? '', ALLOWED_THEMES, true) ? $d['profile_theme'] : 'none';
        $sStyle = in_array($d['showcase_style'] ?? '', ALLOWED_SHOWCASE, true) ? $d['showcase_style'] : 'projecteur';
        $privP = in_array($d['privacy_profile'] ?? '', ALLOWED_PRIVACY, true) ? $d['privacy_profile'] : 'public';
        $privC = in_array($d['privacy_collection'] ?? '', ALLOWED_PRIVACY, true) ? $d['privacy_collection'] : 'public';

        $pdo->prepare(
            'UPDATE joueurs SET bio = ?, avatar_url = ?, avatar_frame = ?, titre = ?, pseudo_style = ?, profile_theme = ?, showcase_style = ?, privacy_profile = ?, privacy_collection = ? WHERE id = ?'
        )->execute([
            $bio !== '' ? $bio : null,
            $avatar !== '' ? $avatar : null,
            $frame,
            $titre !== '' ? $titre : null,
            $pStyle,
            $theme,
            $sStyle,
            $privP,
            $privC,
            $viewerId,
        ]);
        reply(200, ['ok' => true]);
    }

    if ($action === 'showcase') {
        $d = body();
        $rawIds = is_array($d['ids'] ?? null) ? $d['ids'] : [];
        $ids = array_slice(array_values(array_unique(array_filter(array_map('intval', $rawIds), fn($v) => $v > 0))), 0, 7);
        $valid = [];
        if ($ids) {
            $marks = implode(',', array_fill(0, count($ids), '?'));
            $st = $pdo->prepare("SELECT jeu_id FROM collections WHERE joueur_id = ? AND jeu_id IN ($marks)");
            $st->execute(array_merge([$viewerId], $ids));
            $owned = array_flip(array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN)));
            foreach ($ids as $cid) {
                if (isset($owned[$cid])) {
                    $valid[] = $cid;
                }
            }
        }
        $pdo->prepare('UPDATE joueurs SET showcase_ids = ? WHERE id = ?')
            ->execute([$valid ? implode(',', $valid) : null, $viewerId]);
        reply(200, ['ok' => true, 'ids' => $valid]);
    }
} catch (Throwable $e) {
    error_log('GameVault profile: ' . $e->getMessage());
    reply(500, ['error' => 'server_error']);
}
