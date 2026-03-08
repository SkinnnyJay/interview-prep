/**
 * One-off script to generate sorting test data. Run from repo root:
 *   node src/algorithms/generate-sorting-data.js
 * Writes src/algorithms/sorting-data.json
 */
const fs = require("fs");
const path = require("path");

function seededRandom(seed) {
  return function () {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

const rng = seededRandom(42);
const sizes = {
  tiny: 5,
  small: 50,
  medium: 200,
  large: 2000,
  huge: 10000,
};

const data = {};
for (const [name, n] of Object.entries(sizes)) {
  data[name] = Array.from({ length: n }, () => Math.floor(rng() * 10000));
}

const outPath = path.join(__dirname, "sorting-data.json");
fs.writeFileSync(outPath, JSON.stringify(data, null, 0), "utf8");
console.log(
  "Wrote",
  outPath,
  Object.keys(data)
    .map((k) => `${k}:${data[k].length}`)
    .join(", ")
);
