# Rent Smart TZ - Hosting leo

Folder ya `deploy/` ndiyo package ya ku-upload. Server haihitaji Node.js; inahitaji Apache/LiteSpeed, PHP 8.1+ yenye PDO MySQL, MySQL/MariaDB, na `mod_rewrite`.

## 1. Tengeneza database

Tengeneza database yenye jina `estate` kwenye hosting panel/phpMyAdmin. Import `database/schema.sql`.

Kama hosting hairuhusu mistari ya `CREATE DATABASE` na `USE estate`, chagua database yako kwenye phpMyAdmin kisha import schema baada ya kuondoa mistari hiyo miwili. Shared hosting inaweza kuongeza prefix, mfano `account_estate`.

## 2. Weka credentials

Hariri `api/config.php` ndani ya package:

- `db_host`: mara nyingi `localhost`
- `db_name`: `estate` au jina lenye hosting prefix
- `db_user`: MySQL username ya hosting
- `db_pass`: MySQL password
- `app_env`: badilisha kuwa `production`
- `app_url`: domain kamili, mfano `https://estate.example.com`

## 3. Upload

Upload yaliyomo ndani ya `deploy/` kwenda `public_html/` au document root ya domain/subdomain. Usipakie folder `deploy` yenyewe kama unataka system ifunguke moja kwa moja kwenye domain.

Hakikisha Apache/LiteSpeed inaruhusu `.htaccess` na rewrite rules.

## 4. Fungua system

Fungua domain yako bila `index.php`, mfano:

`https://estate.example.com/`

Akaunti ya kwanza inayosajiliwa na kuthibitishwa inakuwa Admin.

Production hutuma OTP kupitia PHP mail(). Angalia inbox/spam. Kama hosting mail haijasanidiwa, badilisha app_env kuwa development kwa muda, sajili Admin wa kwanza na utumie OTP inayoonyeshwa, kisha rudisha app_env kuwa production mara moja.

## Subfolder hosting

Ukihost kwenye subfolder, build tena kabla ya package:

PowerShell:
`$env:VITE_BASE_PATH='/estate/'; npm run deploy`


