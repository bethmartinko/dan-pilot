// DAN Cloud Run server.
//
// Replaces Netlify's invisible magic with an explicit Express server that:
//   1. Serves static files (index.html, stats.html, images, etc.)
//   2. Routes /.netlify/functions/proxy and /.netlify/functions/health to
//      the existing handlers in netlify/functions/, unchanged. The frontend
//      keeps calling the same URLs it calls on Netlify.
//
// Single source of truth for proxy/health logic stays in netlify/functions/.
// A ~15-line adapter translates between Express (req, res) and the
// Netlify handler signature (event -> { statusCode, headers, body }).

const express = require("express");
const path = require("path");

const { handler: proxyHandler } = require("./netlify/functions/proxy");
const { handler: healthHandler } = require("./netlify/functions/health");

const app = express();
const PORT = process.env.PORT || 8080;

// Cloud Run sits behind Google's front-end proxy. Trusting it lets
// req.ip and x-forwarded-for reflect the real client IP so the rate
// limiter in proxy.js works correctly.
app.set("trust proxy", true);

// Keep the request body as a raw string. proxy.js calls
// Buffer.byteLength(event.body) and JSON.parse(event.body); both expect
// a string. Limit matches proxy.js's 512KB payload cap with headroom.
app.use(express.text({ type: "*/*", limit: "1mb" }));

function netlifyAdapter(handler) {
  return async (req, res) => {
    const event = {
      httpMethod: req.method,
      headers: req.headers,
      body: typeof req.body === "string" ? req.body : "",
      queryStringParameters: req.query,
    };
    try {
      const result = await handler(event);
      if (result.headers) {
        for (const [k, v] of Object.entries(result.headers)) {
          res.setHeader(k, v);
        }
      }
      res.status(result.statusCode || 200).send(result.body || "");
    } catch (err) {
      console.error("Handler error:", err);
      res.status(500).json({ error: { type: "internal_error", message: err.message } });
    }
  };
}

app.post("/.netlify/functions/proxy", netlifyAdapter(proxyHandler));
app.get("/.netlify/functions/health", netlifyAdapter(healthHandler));
app.get("/health", netlifyAdapter(healthHandler));

app.use(express.static(__dirname, {
  extensions: ["html"],
  index: "index.html",
}));

const server = app.listen(PORT, () => {
  console.log(`DAN server listening on port ${PORT}`);
});

// Explicit timeouts so Node's defaults (some versions: 2 min socket timeout)
// never trip before Cloud Run's 600s service timeout. headersTimeout must be
// strictly greater than requestTimeout per Node's rules.
server.requestTimeout = 10 * 60 * 1000;      // 10 min — matches Cloud Run
server.headersTimeout = 11 * 60 * 1000;      // 11 min — must exceed requestTimeout
server.keepAliveTimeout = 60 * 1000;         // 60 sec — idle keep-alive
server.timeout = 0;                          // disable legacy socket timeout
