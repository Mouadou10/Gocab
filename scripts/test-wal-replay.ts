import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { replayWalEntriesOntoClient } from "@/lib/sqliteCloudSync";

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
  console.log("WAL entries count:", doc.entries.length);

  // Copy dev.db to a temp test db
  const testDb = "test-replay.db";
  fs.copyFileSync("dev.db", testDb);
  const adapter = new PrismaLibSql({ url: `file:${testDb}` });
  const client = new PrismaClient({ adapter });

  console.log("Before replay:");
  const beforeTarget = await client.setting.findUnique({ where: { key: "department_weekly_targets" } });
  console.log("department_weekly_targets:", beforeTarget?.value);
  const beforePerms = await client.setting.findUnique({ where: { key: "role_tab_permissions" } });
  console.log("role_tab_permissions:", beforePerms?.value);

  const replayed = await replayWalEntriesOntoClient(client, doc.entries);
  console.log("Replayed entries:", replayed);

  console.log("After replay:");
  const afterTarget = await client.setting.findUnique({ where: { key: "department_weekly_targets" } });
  console.log("department_weekly_targets:", afterTarget?.value);
  const afterPerms = await client.setting.findUnique({ where: { key: "role_tab_permissions" } });
  console.log("role_tab_permissions:", afterPerms?.value);

  await client.$disconnect();
  try { fs.unlinkSync(testDb); } catch {}
}

run().catch(console.error);
