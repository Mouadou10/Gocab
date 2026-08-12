const Database = require("better-sqlite3");
const path = require("path");

const path1 = path.join(__dirname, "..", "dev.db");
const path2 = path.join(__dirname, "..", "prisma", "dev.db");

console.log("Checking DB 1:", path1);
try {
  const db1 = new Database(path1);
  console.log("DB 1 Tables:", db1.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());
} catch(e) { console.error(e); }

console.log("Checking DB 2:", path2);
try {
  const db2 = new Database(path2);
  console.log("DB 2 Tables:", db2.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());
} catch(e) { console.error(e); }
