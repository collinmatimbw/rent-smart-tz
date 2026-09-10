# Rent Smart TZ

Rent Smart TZ ni mfumo wa property/estate management unaotumia React frontend, PHP API, na MySQL/MariaDB database `estate`.

## Local development

1. Washa Apache na MySQL kwenye XAMPP.
2. Import `database/schema.sql` kwenye phpMyAdmin.
3. Endesha:

```bash
npm install
npm run dev
```

Fungua http://127.0.0.1:5173/.

Default local connection iko `api/config.php`: host `127.0.0.1`, database `estate`, user `root`, password tupu.

## Tengeneza package ya hosting

```bash
npm run deploy
```

Command hii inabuild CSS/JS na kutengeneza folder `deploy/`. Server ya hosting haihitaji Node.js.

Upload yaliyomo ndani ya `deploy/` kwenda document root ya domain, kisha hariri `api/config.php` kwa MySQL credentials na domain yako. Maelekezo kamili yako kwenye `HOSTING.md` na ndani ya package.

Akaunti ya kwanza pekee ndiyo inaweza kujisajili publicly na inakuwa Admin. Baada ya hapo Admin anaongeza watumiaji wengine kupitia Users.

## Verification

```bash
npm run lint
npm run build
php -l index.php
php -l api/index.php
```

AI Assistant ni optional. Weka `OPENAI_API_KEY` na `OPENAI_MODEL` kwenye PHP server environment ukiihitaji.
