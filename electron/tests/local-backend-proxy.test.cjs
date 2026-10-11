const assert = require("node:assert/strict");
const { test } = require("node:test");

test("web preview proxy refuses foreign origins, hosts, fetch sites and clients", () => {
  const { isTrustedProxyRequest } = require("../../scripts/local-backend-proxy.cjs");
  const request = { headers: { host: "127.0.0.1:5173", origin: "http://127.0.0.1:5173", "sec-fetch-site": "same-origin" }, socket: { remoteAddress: "127.0.0.1" } };
  assert.equal(isTrustedProxyRequest(request, 5173), true);
  for (const headers of [
    { ...request.headers, origin: "null" }, { ...request.headers, origin: "https://attacker.example" },
    { ...request.headers, host: "attacker.example:5173" }, { ...request.headers, "sec-fetch-site": "cross-site" },
    { ...request.headers, "sec-fetch-site": "same-site", origin: "http://127.0.0.1:9999" }
  ]) assert.equal(isTrustedProxyRequest({ ...request, headers }, 5173), false);
  assert.equal(isTrustedProxyRequest({ ...request, socket: { remoteAddress: "192.168.1.2" } }, 5173), false);
});
