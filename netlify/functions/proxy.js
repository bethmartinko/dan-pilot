const https = require("https");

// ===== PII SCRUBBER (Tracker 2.52) =====
// Scrubs free-text fields in Airtable writes before they leave the proxy.
// The live chat window is unaffected — only the persisted record is scrubbed.
// Categories: email, US phone, SSN, street address, ZIP+4, DOB-shaped date,
// credit card (Luhn-validated), RC case-id (contextual). Counts are logged
// per request for telemetry.

// Phone numbers DAN itself publishes — must NOT be scrubbed when DAN echoes
// them back. Sourced from index.html: OCRA, DRC, fair hearing, DDS Ombudsperson,
// 21 RC mains + branches. (OAH decision 2025070280 also safelisted — would
// otherwise match the phone shape.)
const PII_SAFE_PHONES = new Set([
  "2025070280",  // OAH decision (not a phone)
  "8003907032",  // OCRA
  "8007438525",  // Fair hearing
  "8007765746",  // DRC
  "8004144614",
  "8008841594",
  "8776589731",  // DDS Ombudsperson
  "2099553255", "2094730951", "2097234245",
  "2133831300", "2137447000",
  "3102584000", "3105401711", "3105430100",
  "4083749960",
  "4155174503", "4155469222",
  "5106186100",
  "5302224791",
  "5592764300", "5597382200",
  "6194893200",
  "6262994700",
  "6613278531", "6613286749", "6617758450", "6619456761",
  "7072561100", "7074450893", "7079958103",
  "7147965100",
  "8059224640", "8059627881",
  "8187781900",
  "8319003636", "8319003737",
  "8585762996", "8589248700",
  "9096207722", "9098903000",
  "9166543641", "9169786400",
  "9256912300", "9257983001",
]);

function piiNormalizePhone(s) {
  const d = s.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

function piiLuhnValid(digits) {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = +digits[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const PII_PATTERNS = {
  email:   /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  ssn:     /\b\d{3}-\d{2}-\d{4}\b/g,
  phone:   /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  zip4:    /\b\d{5}-\d{4}\b/g,
  address: /\b\d+\s+[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){0,3}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Way|Ct|Court|Pl|Place|Hwy|Highway|Pkwy|Parkway)\b\.?/g,
  dob:     /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
  cc:      /\b(?:\d[ -]?){12,18}\d\b/g,
  caseId:  /\b(?:client|case|patient|account|RC)\s*(?:id|number|no\.?|#)\s*:?\s*([A-Z0-9-]{4,12})\b/gi,
};

function piiScrubString(s) {
  const counts = {};
  const bump = (k) => { counts[k] = (counts[k] || 0) + 1; };
  let out = s;

  out = out.replace(PII_PATTERNS.email, () => { bump("email"); return "[email]"; });
  out = out.replace(PII_PATTERNS.ssn,   () => { bump("ssn");   return "[ssn]";   });
  out = out.replace(PII_PATTERNS.phone, (m) => {
    if (PII_SAFE_PHONES.has(piiNormalizePhone(m))) return m;
    bump("phone"); return "[phone]";
  });
  out = out.replace(PII_PATTERNS.zip4,    () => { bump("zip");     return "[zip]";       });
  out = out.replace(PII_PATTERNS.address, () => { bump("address"); return "[address]";   });
  out = out.replace(PII_PATTERNS.dob,     () => { bump("dob");     return "[date]";      });
  out = out.replace(PII_PATTERNS.cc, (m) => {
    const d = m.replace(/\D/g, "");
    if (d.length < 13 || d.length > 19) return m;
    if (!piiLuhnValid(d)) return m;
    bump("cc"); return "[card]";
  });
  out = out.replace(PII_PATTERNS.caseId, () => { bump("caseid"); return "[client-id]"; });

  return { value: out, counts };
}

// Field names that are intentionally collected and should pass through
// unscrubbed. "Session ID" contains 13-digit ms-timestamps that would
// falsely match the phone pattern; "Email" is the user's opted-in signup
// email; the rest are system-generated metadata.
const PII_SKIP_FIELDS = new Set([
  "Email",
  "Session ID",
  "Last Active",
  "Timestamp",
]);

function piiScrubFields(fields) {
  if (!fields || typeof fields !== "object") return { fields, totals: {} };
  const totals = {};
  const out = {};
  for (const [key, val] of Object.entries(fields)) {
    if (PII_SKIP_FIELDS.has(key) || typeof val !== "string") {
      out[key] = val;
      continue;
    }
    const { value, counts } = piiScrubString(val);
    out[key] = value;
    for (const [cat, n] of Object.entries(counts)) totals[cat] = (totals[cat] || 0) + n;
  }
  return { fields: out, totals };
}
// ===== END PII SCRUBBER =====

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
    const { fields: scrubbedFields, totals } = piiScrubFields(payload.fields);
    if (Object.keys(totals).length > 0) {
      console.log(JSON.stringify({ pii_scrub: totals, op: "post", url: payload.url }));
    }
    const airtableBody = { fields: scrubbedFields };
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
    const { fields: scrubbedFields, totals } = piiScrubFields(payload.fields);
    if (Object.keys(totals).length > 0) {
      console.log(JSON.stringify({ pii_scrub: totals, op: "patch", url: payload.url }));
    }
    const airtableBody = { fields: scrubbedFields };
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

// Exposed for unit testing (dan_pii_scrub_test.js). Not used by the Netlify
// or Cloud Run runtimes, which only invoke .handler.
exports.piiScrubFields = piiScrubFields;
exports.piiScrubString = piiScrubString;
