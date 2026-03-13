const https = require("https");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const target = event.headers["x-target"];

  function httpsPost(url, headers, body, timeoutMs) {
    timeoutMs = timeoutMs || 25000;
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
    try {
      const result = await httpsPost(
        "https://api.anthropic.com/v1/messages",
        {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        event.body,
        25000
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
    const result = await httpsPost(
      payload.url,
      {
        "Authorization": `Bearer ${process.env.AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      JSON.stringify({ fields: payload.fields })
    );
    return {
      statusCode: result.status,
      headers: { "Content-Type": "application/json" },
      body: result.body,
    };
  }

  if (target === "airtable-patch") {
    const payload = JSON.parse(event.body);
    const result = await httpsPatch(
      payload.url,
      {
        "Authorization": `Bearer ${process.env.AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      JSON.stringify({ fields: payload.fields })
    );
    return {
      statusCode: result.status,
      headers: { "Content-Type": "application/json" },
      body: result.body,
    };
  }

  return { statusCode: 400, body: "Unknown target" };
};
