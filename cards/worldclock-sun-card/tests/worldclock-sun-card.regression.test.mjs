import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const sourceUrl = new URL("../worldclock-sun-card.js", import.meta.url);
const distributionUrl = new URL("../../../dist/worldclock-sun-card.js", import.meta.url);
const sourceFlagsUrl = new URL("../flags/", import.meta.url);
const distributionFlagsUrl = new URL("../../../dist/flags/", import.meta.url);
const bundleUrl = new URL("../../../dist/home-assistant-dashboard-cards.js", import.meta.url);
const source = readFileSync(sourceUrl, "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in the runtime source`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

function listFiles(directoryUrl) {
  return readdirSync(directoryUrl, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

test("HACS distribution contains every bundled flag byte-for-byte", () => {
  assert.equal(existsSync(distributionFlagsUrl), true, "dist/flags must exist");
  const sourceFiles = listFiles(sourceFlagsUrl);
  const distributionFiles = listFiles(distributionFlagsUrl);
  assert.deepEqual(distributionFiles, sourceFiles);
  assert.equal(sourceFiles.length, 271);

  for (const filename of sourceFiles) {
    const sourceFile = new URL(filename, sourceFlagsUrl);
    const distributionFile = new URL(filename, distributionFlagsUrl);
    assert.equal(statSync(distributionFile).size, statSync(sourceFile).size, `${filename} size differs`);
    assert.deepEqual(readFileSync(distributionFile), readFileSync(sourceFile), `${filename} content differs`);
  }
});

test("unrelated Home Assistant state updates do not rebuild flag images", () => {
  const shouldRender = vm.runInNewContext(`(${extractFunction("shouldRenderForHassChange")})`);
  const sharedLocation = { entity: "sensor.london_time" };
  const state = { state: "1:00 PM" };
  const previous = {
    language: "en",
    config: { time_zone: "America/Los_Angeles", latitude: 1, longitude: 2 },
    states: { "sensor.london_time": state, "sensor.unrelated": { state: "off" } },
  };
  const unrelatedUpdate = {
    ...previous,
    states: { ...previous.states, "sensor.unrelated": { state: "on" } },
  };
  const relevantUpdate = {
    ...previous,
    states: { ...previous.states, "sensor.london_time": { state: "1:01 PM" } },
  };

  assert.equal(shouldRender(null, previous, [sharedLocation]), true);
  assert.equal(shouldRender(previous, unrelatedUpdate, [sharedLocation]), false);
  assert.equal(shouldRender(previous, relevantUpdate, [sharedLocation]), true);
});

test("runtime and HACS entry point advertise Worldclock Sun Card v1.4.3", () => {
  const distribution = readFileSync(distributionUrl, "utf8");
  const bundle = readFileSync(bundleUrl, "utf8");
  assert.equal(distribution, source);
  assert.match(source, /const CARD_VERSION = "1\.4\.3";/);
  assert.match(source, /decoding="sync"/);
  assert.match(bundle, /import "\.\/worldclock-sun-card\.js\?v=1\.4\.3";/);
});

