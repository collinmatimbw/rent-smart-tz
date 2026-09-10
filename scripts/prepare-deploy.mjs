import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const deploy = resolve(root, "deploy");

if (deploy !== join(root, "deploy") || !deploy.startsWith(root + sep)) {
  throw new Error("Unsafe deployment output path.");
}
if (!existsSync(join(root, "public", "index.html"))) {
  throw new Error("Frontend build is missing. Run npm run build first.");
}

rmSync(deploy, { recursive: true, force: true });
mkdirSync(deploy, { recursive: true });

copyFileSync(join(root, "index.php"), join(deploy, "index.php"));
copyFileSync(join(root, ".htaccess"), join(deploy, ".htaccess"));
copyFileSync(join(root, "HOSTING.md"), join(deploy, "HOSTING.md"));
copyFileSync(join(root, "public", "index.html"), join(deploy, "app.html"));

for (const entry of readdirSync(join(root, "public"), { withFileTypes: true })) {
  if (entry.name === "index.html") continue;
  cpSync(join(root, "public", entry.name), join(deploy, entry.name), {
    recursive: true,
  });
}

mkdirSync(join(deploy, "api"), { recursive: true });
copyFileSync(join(root, "api", "index.php"), join(deploy, "api", "index.php"));
const productionConfig = readFileSync(
  join(root, "api", "config.example.php"),
  "utf8",
)
  .replace(
    "getenv('APP_ENV') ?: 'development'",
    "getenv('APP_ENV') ?: 'production'",
  )
  .replace(
    "http://localhost/rent-smart-tz",
    "https://your-domain.example",
  );
writeFileSync(join(deploy, "api", "config.php"), productionConfig);

mkdirSync(join(deploy, "database"), { recursive: true });
copyFileSync(
  join(root, "database", "schema.sql"),
  join(deploy, "database", "schema.sql"),
);

console.log("Hosting package ready:", deploy);
