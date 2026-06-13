// Vercel serverless APS token endpoint. Credentials live in Vercel env vars
// (APS_CLIENT_ID / APS_CLIENT_SECRET) — never in the client.
// Returns a viewer-scoped (data:read) 2-legged token.
export default async function handler(req, res) {
  const id = process.env.APS_CLIENT_ID;
  const secret = process.env.APS_CLIENT_SECRET;
  if (!id || !secret) {
    res.status(500).json({ error: "APS_CLIENT_ID / APS_CLIENT_SECRET not set in Vercel env" });
    return;
  }
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const r = await fetch("https://developer.api.autodesk.com/authentication/v2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=data:read", // viewer scope only
  });
  if (!r.ok) {
    res.status(502).json({ error: "token request failed" });
    return;
  }
  const j = await r.json();
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ access_token: j.access_token, expires_in: j.expires_in });
}
