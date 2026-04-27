const https = require("https");

// -- ADVERSARIAL-COST MITIGATION (Risk Mitigation Framework #12) --
// Netlify Functions are stateless across cold starts, but warm containers
// reuse module-level memory for minutes to hours. That's enough to blunt
// burst botting while GCP migration lands, where persistent state is easy.
//
// Post-GCP: replace with Redis / Firestore-backed limiter for hard cost cap.
const RATE_LIMIT = {
  windowMs: 10 * 60 * 1000,  // 10-minute rolling window
  maxAnthropic: 30,          // legitimate family: 3-5 sessions; 30 is abuse signal
  maxPayloadBytes: 512 * 1024, // Appeals card alone is ~99KB of KBs + base prompt + convo history; 512KB leaves headroom for long sessions while blocking genuine MB-scale abuse
};
const ipHits = new Map();    // ip -> [timestamp, timestamp, ...]

function rateCheck(ip) {
  if (!ip) return { allowed: true };  // unknown IP (dev/test) — don't block
  const now = Date.now();
  const windowStart = now - RATE_LIMIT.windowMs;
  const hits = (ipHits.get(ip) || []).filter(t => t > windowStart);
  if (hits.length >= RATE_LIMIT.maxAnthropic) {
    return { allowed: false, count: hits.length };
  }
  hits.push(now);
  ipHits.set(ip, hits);
  // Opportunistic cleanup: if the map gets large, drop stale entries
  if (ipHits.size > 500) {
    for (const [k, v] of ipHits) {
      const kept = v.filter(t => t > windowStart);
      if (kept.length === 0) ipHits.delete(k); else ipHits.set(k, kept);
    }
  }
  return { allowed: true, count: hits.length };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const target = event.headers["x-target"];

  function httpsPost(url, headers, body, timeoutMs) {
    // 9.5 min default — raised from 55s as part of GCP Cloud Run migration.
    // On Netlify the platform's sync function cap (~30s) still kills first;
    // on Cloud Run this lets long Anthropic responses complete cleanly.
    timeoutMs = timeoutMs || 570000;
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
        reject(new Error("Request timed out after " + timeoutMs + "ms"));
      });
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }

  function httpsPatch(url, headers, body) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: "PATCH",
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
      };
      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      });
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }

  if (target === "anthropic") {
    // Payload size cap — reject anything that blows past legit session sizes
    if (event.body && Buffer.byteLength(event.body) > RATE_LIMIT.maxPayloadBytes) {
      return {
        statusCode: 413,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: { type: "payload_too_large", message: "Message too large. Please shorten your input and try again." } }),
      };
    }
    // IP rate limit — reject burst patterns that indicate botting
    const clientIp = event.headers["x-forwarded-for"]
      ? event.headers["x-forwarded-for"].split(",")[0].trim()
      : event.headers["client-ip"] || null;
    const rc = rateCheck(clientIp);
    if (!rc.allowed) {
      console.warn(`Rate limit hit: ip=${clientIp} count=${rc.count}`);
      return {
        statusCode: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "600" },
        body: JSON.stringify({
          error: {
            type: "rate_limited",
            message: "DAN has reached a usage limit for this session. Please try again in a few minutes, or call OCRA at 1-800-390-7032 for free immediate help."
          }
        }),
      };
    }
    try {
      // 9.5 min first attempt, 9.67 min on retry (post-GCP values).
      const retryNum = parseInt(event.headers["x-retry"] || "0", 10);
      const timeout = retryNum > 0 ? 580000 : 570000;
      const result = await httpsPost(
        "https://api.anthropic.com/v1/messages",
        {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        event.body,
        timeout
      );
      return {
        statusCode: result.status,
        headers: { "Content-Type": "application/json" },
        body: result.body,
      };
    } catch (err) {
      console.error("Anthropic proxy error:", err.message);
      return {
        statusCode: 503,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: { type: "proxy_timeout", message: err.message } }),
      };
    }
  }

  if (target === "airtable-post") {
    const payload = JSON.parse(event.body);
    const airtableBody = { fields: payload.fields };
    if (payload.typecast === true) airtableBody.typecast = true;
    const result = await httpsPost(
      payload.url,
      {
        "Authorization": `Bearer ${process.env.AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      JSON.stringify(airtableBody)
    );
    return {
      statusCode: result.status,
      headers: { "Content-Type": "application/json" },
      body: result.body,
    };
  }

  if (target === "airtable-patch") {
    const payload = JSON.parse(event.body);
    const airtableBody = { fields: payload.fields };
    if (payload.typecast === true) airtableBody.typecast = true;
    const result = await httpsPatch(
      payload.url,
      {
        "Authorization": `Bearer ${process.env.AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      JSON.stringify(airtableBody)
    );
    return {
      statusCode: result.status,
      headers: { "Content-Type": "application/json" },
      body: result.body,
    };
  }

  return { statusCode: 400, body: "Unknown target" };
};
