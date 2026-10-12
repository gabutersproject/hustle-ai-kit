import { cpSync, mkdirSync, rmSync } from "node:fs";

rmSync("public/desk", { recursive: true, force: true });
mkdirSync("public/desk/engine", { recursive: true });

const files = [
  "__init__.py",
  "bridge.py",
  "deadlines.py",
  "letter.py",
  "money.py",
  "pricer.py",
  "reader.py",
  "schemas.py",
  "store.py",
];

for (const name of files) {
  cpSync(`engine/${name}`, `public/desk/engine/${name}`);
}
cpSync("data/pricebook.default.json", "public/desk/pricebook.default.json");
