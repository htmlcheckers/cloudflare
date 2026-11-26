import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const jsRoot = fileURLToPath(new URL("../public/assets/js", import.meta.url));

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

test("index.html import map lists every module (cache busting stays in sync)", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const files = walk(jsRoot)
  .map((f) => relative(jsRoot, f).replaceAll("\\", "/"))
  .filter((f) => f.endsWith(".js") && f !== "main.js");
  files.forEach((file) => assert.ok(html.includes(`"${file}"`), `index.html is missing ${file}`));
});

test("layering: core/ and app/ never touch the DOM or browser globals", () => {
  const banned = /\b(document|window|localStorage|navigator|Audio)\b/;
  walk(jsRoot)
    .filter((f) => /\/(core|app)\//.test(f))
    .forEach((file) => {
      const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      assert.ok(!banned.test(code), `${relative(jsRoot, file)} uses a browser global`);
    });
});

test("chat/bot never imports from ui/ or reads the game directly", () => {
  walk(join(jsRoot, "chat/bot")).forEach((file) => {
    const code = readFileSync(file, "utf8");
    assert.ok(!/from "\.\.\/\.\.\/(ui|app|core)\//.test(code), `${relative(jsRoot, file)} imports game/ui code`);
    assert.ok(!/\bdocument\b|\bwindow\b/.test(code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), `${relative(jsRoot, file)} touches the DOM`);
  });
});
