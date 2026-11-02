import fs from "node:fs";
import crypto from "node:crypto";

const src = fs.readFileSync("src/lib/sqliteCloudSync.ts", "utf8");
const key = src.split("const DEFAULT_PRIVATE_KEY = `")[1].split("`;")[0];
const email = "google-drive@gen-lang-client-0868678110.iam.gserviceaccount.com";
const FILE_ID = "175MkGtkerSbnU7QDsaIz0y3XdI9DHkY8";

async function token() {
  const iat = Math.floor(Date.now() / 1000);
  const h = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const c = Buffer.from(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/drive", aud: "https://oauth2.googleapis.com/token", exp: iat + 3600, iat })).toString("base64url");
  const s = crypto.createSign("RSA-SHA256"); s.update(h + "." + c);
  const jwt = `${h}.${c}.${s.sign(key, "base64url")}`;
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}` });
  return (await r.json()).access_token;
}

async function run() {
  const t = await token();
  const doc = await (await fetch(`https://www.googleapis.com/drive/v3/files/${FILE_ID}?alt=media`, { headers: { Authorization: `Bearer ${t}` } })).json();
  const counts: Record<string, number> = {};
  for (const e of doc.entries) {
    counts[e.model + "." + e.method] = (counts[e.model + "." + e.method] || 0) + 1;
  }
  console.log("Counts by model.method:", counts);
}

run().catch(console.error);
