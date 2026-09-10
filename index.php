<?php
declare(strict_types=1);

$documents = [
    __DIR__ . '/app.html',
    __DIR__ . '/public/index.html',
];

foreach ($documents as $document) {
    if (is_file($document)) {
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-cache');
        readfile($document);
        exit;
    }
}

http_response_code(503);
header('Content-Type: text/plain; charset=utf-8');
echo "Rent Smart TZ has not been built yet. Run: npm install && npm run deploy";
