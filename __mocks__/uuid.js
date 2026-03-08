// Minimal uuid v4 mock for Jest environments that struggle with the ESM version.
// Provides deterministic, unique-ish identifiers per invocation.
let counter = 0;

function padHex(value, length) {
  return value.toString(16).padStart(length, '0');
}

function mockV4() {
  counter += 1;
  const time = Date.now() + counter;
  const random = counter * 0xabcdef;

  // Compose a stable UUID-like string (8-4-4-4-12)
  return [
    padHex(time & 0xffffffff, 8),
    padHex((time >> 32) & 0xffff, 4),
    padHex(0x4000 | (random & 0x0fff), 4), // version 4 bits
    padHex(0x8000 | (random & 0x3fff), 4), // variant bits
    padHex((random * 2654435761) & 0xffffffffffff, 12)
  ].join('-');
}

module.exports = {
  v4: mockV4
};
