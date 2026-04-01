———const https = require("https");

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

    // 1. Site check — fetch the main page
    results.checks.site = await checkSite();

    // 2. Anthropic API check — lightweight messages request
    results.checks.anthropic = await checkAnthropic();

    // 3. Airtable check — read-only list request
    results.checks.airtable = await checkAirtable();

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
          const urlObj = new URL(url);
          const options = {
                  hostname: urlObj.hostname,
                  path: urlObj.pathname + urlObj.search,
                  method: "GET",
                  headers: headers || {},
                  timeout: timeoutMs,
          };
          const req = https.request(options, (res) => {
                  let data = "";
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
          const urlObj = new URL(url);
          const options = {
                  hostname: urlObj.hostname,
                  path: urlObj.pathname + urlObj.search,
                  method: "POST",
                  headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
                  timeout: timeoutMs,
          };
          const req = https.request(options, (res) => {
                  let data = "";
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
    const start = Date.now();
    try {
          const siteUrl = process.env.URL || "https://dan-pilot.netlify.app";
          const res = await httpsGet(siteUrl, {}, 10000);
          const ms = Date.now() - start;
          const ok = res.status === 200 && res.body.includes("Disability Access Navigator");
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
    const start = Date.now();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
          return { status: "fail", detail: "ANTHROPIC_API_KEY not set" };
    }
    try {
          // Minimal request — short system message, 1 max token
      const body = JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1,
              messages: [{ role: "user", content: "ping" }],
      });
          const res = await httpsPost(
                  "https://api.anthropic.com/v1/messages",
            {
                      "Content-Type": "application/json",
                      "x-api-key": apiKey,
                      "anthropic-version": "2023-06-01",
            },
                  body,
                  15000
                );
          const ms = Date.now() - start;
          const ok = res.status === 200;
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

async function checkAirtable() {
    const start = Date.now();
    const token = process.env.AIRTABLE_TOKEN;
    if (!token) {
          return { status: "fail", detail: "AIRTABLE_TOKEN not set" };
    }
    try {
          // Read 1 record from sessions table — uses existing token permissions
      const baseId = "applBHiDsZwGSmFS8";
          const tableId = "tblbD7M4U56FMlZwE";
          const res = await httpsGet(
                  "https://api.airtable.com/v0/" + baseId + "/" + tableId + "?maxRecords=1",
            { Authorization: "Bearer " + token },
                  10000
                );
          const ms = Date.now() - start;
          const ok = res.status === 200;
          return {
                  status: ok ? "ok" : "fail",
                  responseTime: ms,
                  httpStatus: res.status,
                  detail: ok ? "Airtable API responding" : "HTTP " + res.status,
          };
    } catch (err) {
          return {
                  status: "fail",
                  responseTime: Date.now() - start,
                  detail: err.message,
          };
    }
}
