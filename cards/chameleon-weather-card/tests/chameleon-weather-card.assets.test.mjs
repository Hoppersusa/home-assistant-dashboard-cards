import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const sourceUrl = new URL("../chameleon-weather-card.js", import.meta.url);
const distributionUrl = new URL("../../../dist/chameleon-weather-card.js", import.meta.url);
const sourceImagesUrl = new URL("../images/", import.meta.url);
const distributionImagesUrl = new URL("../../../dist/images/", import.meta.url);
const bundleUrl = new URL("../../../dist/home-assistant-dashboard-cards.js", import.meta.url);

function listFiles(rootUrl, currentUrl = rootUrl) {
  return readdirSync(currentUrl, { withFileTypes: true }).flatMap((entry) => {
    const entryUrl = new URL(entry.name + (entry.isDirectory() ? "/" : ""), currentUrl);
    if (entry.isDirectory()) return listFiles(rootUrl, entryUrl);
    const relative = decodeURIComponent(entryUrl.pathname.slice(rootUrl.pathname.length));
    return [relative];
  });
}

test("HACS distribution contains every Chameleon image byte-for-byte", () => {
  assert.equal(existsSync(distributionImagesUrl), true, "dist/images must exist");
  const sourceFiles = listFiles(sourceImagesUrl).sort();
  const distributionFiles = listFiles(distributionImagesUrl).sort();
  assert.deepEqual(distributionFiles, sourceFiles);
  assert.equal(sourceFiles.length, 34);

  for (const relative of sourceFiles) {
    const sourceFile = new URL(relative, sourceImagesUrl);
    const distributionFile = new URL(relative, distributionImagesUrl);
    assert.equal(statSync(distributionFile).size, statSync(sourceFile).size, `${relative} size differs`);
    assert.deepEqual(readFileSync(distributionFile), readFileSync(sourceFile), `${relative} content differs`);
  }
});

test("runtime and HACS entry point advertise Chameleon Weather Card v1.2.2", () => {
  const source = readFileSync(sourceUrl, "utf8");
  const distribution = readFileSync(distributionUrl, "utf8");
  const bundle = readFileSync(bundleUrl, "utf8");
  assert.equal(distribution, source);
  assert.match(source, /const CARD_VERSION = "1\.2\.2";/);
  assert.match(bundle, /import "\.\/chameleon-weather-card\.js\?v=1\.2\.2";/);
});

test("local artwork URLs are versioned to bypass cached missing-image responses", () => {
  const source = readFileSync(sourceUrl, "utf8");
  assert.match(source, /url\.searchParams\.set\("cw-version", CARD_VERSION\);/);
  assert.match(source, /!\/\^\(\?:https\?:\|data:\|blob:\)\/i\.test\(value\)/);
});

