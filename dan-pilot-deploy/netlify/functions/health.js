const https = require("https");

// Health check endpoint for uptime monitoring
// GET /.netlify/functions/health
// Returns JSON with status of each service component

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const results = {
    timestamp: new Date().toISOString(),
    checks: {},
    overall: "ok",
  };

  // 1. Site check - fetch the main page
  results.checks.site = await checkSite();

  // 2. Anthropic API check - lightweight messages request
  results.checks.anthropic = await checkAnthropic();

  // Determine overall status
  const statuses = Object.values(results.checks).map((c) => c.status);
  if (statuses.some((s) => s === "fail")) {
    results.overall = "degraded";
  }
  if (statuses.every((s) => s === "fail")) {
    results.overall = "down";
  }

  const statusCode = results.overall === "ok" ? 200 : 503;

  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(results, null, 2),
  };
};

function httpsGet(url, headers, timeoutMs) {
  timeoutMs = timeoutMs || 10000;
  return new Promise((resolve, reject) => {
    var urlObj = new URL(url);
    var options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers: headers || {},
      timeout: timeoutMs,
    };
    var req = https.request(options, (res) => {
      var data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timed out after " + timeoutMs + "ms"));
    });
    req.on("error", reject);
    req.end();
  });
}

function httpsPost(url, headers, body, timeoutMs) {
  timeoutMs = timeoutMs || 15000;
  return new Promise((resolve, reject) => {
    var urlObj = new URL(url);
    var options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: Object.assign({}, headers, { "Content-Length": Buffer.byteLength(body) }),
      timeout: timeoutMs,
    };
    var req = https.request(options, (res) => {
      var data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timed out after " + timeoutMs + "ms"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function checkSite() {
  var start = Date.now();
  try {
    var siteUrl = process.env.URL || "https://dan-pilot.netlify.app";
    var res = await httpsGet(siteUrl, {}, 10000);
    var ms = Date.now() - start;
    var ok = res.status === 200 && res.body.includes("Disability Access Navigator");
    return {
      status: ok ? "ok" : "fail",
      responseTime: ms,
      httpStatus: res.status,
      detail: ok ? "Site loaded successfully" : "Unexpected response",
    };
  } catch (err) {
    return {
      status: "fail",
      responseTime: Date.now() - start,
      detail: err.message,
    };
  }
}

async function checkAnthropic() {
  var start = Date.now();
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { status: "fail", detail: "ANTHROPIC_API_KEY not set" };
  }
  try {
    var body = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    var res = await httpsPost(
      "https://api.anthropic.com/v1/messages",
      {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body,
      15000
    );
    var ms = Date.now() - start;
    var ok = res.status === 200;
    return {
      status: ok ? "ok" : "fail",
      responseTime: ms,
      httpStatus: res.status,
      detail: ok ? "Anthropic API responding" : "HTTP " + res.status,
    };
  } catch (err) {
    return {
      status: "fail",
      responseTime: Date.now() - start,
      detail: err.message,
    };
  }
}
