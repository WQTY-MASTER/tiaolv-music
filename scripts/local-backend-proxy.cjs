const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tokenHeader = "X-Tiaolv-Token";

function isTrustedProxyRequest(request, port) {
  const host = request.headers.host;
  const origin = request.headers.origin;
  const site = request.headers["sec-fetch-site"];
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress)
    && [`127.0.0.1:${port}`, `localhost:${port}`].includes(host)
    && (!origin || origin === `http://${host}`)
    && (!site || ["same-origin", "none"].includes(site));
}

function readToken() {
  const file = process.env.LISTENMUSIC_LOCAL_ACCESS_TOKEN_FILE || path.join(os.homedir(), ".tiaolv-music", "local-access.token");
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 66) throw new Error("Local API is not ready");
  const token = fs.readFileSync(file, "ascii").trim();
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Local API is not ready");
  return token;
}

function localBackendProxy() {
  return {
    name: "tiaolv-local-backend",
    configureServer(server) {
      server.middlewares.use("/backend", (request, response, next) => {
        if (!isTrustedProxyRequest(request, server.httpServer?.address()?.port || server.config.server.port)) {
          response.statusCode = 403;
          response.end("Local preview access denied");
          return;
        }
        try {
          request.headers[tokenHeader.toLowerCase()] = readToken();
          delete request.headers.origin;
          next();
        } catch {
          response.statusCode = 503;
          response.end("Start the Java backend before using the preview");
        }
      });
    }
  };
}

module.exports = { isTrustedProxyRequest, localBackendProxy };
