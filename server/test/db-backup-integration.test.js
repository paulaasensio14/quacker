import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serverSource = fs.readFileSync(
  new URL("../server.js", import.meta.url),
  "utf8"
);

test("las escrituras de db.json conservan backups rotados", () => {
  assert.match(
    serverSource,
    /writeJsonFileAtomic\(\s*DB_PATH,\s*db,\s*\{[\s\S]{0,200}backupPrevious:\s*true[\s\S]{0,200}backupLimit:\s*5[\s\S]{0,100}\}\s*\)/
  );
});
