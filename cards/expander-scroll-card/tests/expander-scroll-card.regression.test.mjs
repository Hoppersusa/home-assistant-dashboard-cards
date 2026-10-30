import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../expander-scroll-card.js", import.meta.url), "utf8");
const distributionUrl = new URL("../../../dist/expander-scroll-card.js", import.meta.url);
const hasDistribution = existsSync(distributionUrl);
const distribution = hasDistribution ? readFileSync(distributionUrl, "utf8") : null;

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

function loadFunction(name) {
  return vm.runInNewContext(`(${extractFunction(name)})`);
}

test("source and HACS distribution stay byte-identical", { skip: !hasDistribution }, () => {
  assert.equal(distribution, source);
  assert.match(source, /const VERSION = "1\\.2\\.4";/);
});

test("no scrollbar means no reserved width", () => {
  const calculate = loadFunction("calculateScrollbarCompensation");
  assert.equal(calculate(false, 500, 485), 0);
  assert.equal(calculate(false, 500, 500), 0);
  assert.match(source, /scrollbar-gutter: auto;/);
});

test("a real scrollbar is compensated without allowing a negative width", () => {
  const calculate = loadFunction("calculateScrollbarCompensation");
  assert.equal(calculate(true, 500, 485), 15);
  assert.equal(calculate(true, 485, 500), 0);
  assert.match(source, /padding-inline-end: var\\(--expanded-scrollbar-compensation, 0px\\);/);
});

test("nested card-updated events are contained and listeners are cleaned up", () => {
  const contain = loadFunction("containNestedCardUpdated");
  let stopCount = 0;
  contain({ stopPropagation: () => { stopCount += 1; } });
  assert.equal(stopCount, 1);
  assert.match(source, /addEventListener\\("card-updated", containNestedCardUpdated\\);/);
  assert.match(source, /removeEventListener\\("card-updated", containNestedCardUpdated\\);/);
});
