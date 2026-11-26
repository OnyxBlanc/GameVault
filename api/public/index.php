<?php
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'GET' && parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) === '/health') {
    echo json_encode(['status' => 'ok']);
    exit;
}
http_response_code(404);
echo json_encode(['error' => 'not_found']);
