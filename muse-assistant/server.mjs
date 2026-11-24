import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec, spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOCAB_ROOT = path.resolve(__dirname, "..");
const PORT = 47821;
const MAX_HISTORY_MESSAGES = 12; // 6 rolling turns max
const MAX_TOOL_OUTPUT_CHARS = 2200;
const MAX_CLICK_LOG = 5;

let rollingHistory = [];
let totalTokensUsed = 0;
let clickBreadcrumbs = [];
let clickWatcherProc = null;
let currentStatus = { state: "idle", detail: "Click Listening to speak a task." };

function loadEnvKey(keyName) {
  if (process.env[keyName]) return process.env[keyName];
  for (const file of [".env.local", ".env"]) {
    const full = path.join(GOCAB_ROOT, file);
    if (!fs.existsSync(full)) continue;
    const lines = fs.readFileSync(full, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[1] === keyName) {
        return m[2].replace(/^['"]|['"]$/g, "").trim();
      }
    }
  }
  return "";
}

function setStatus(state, detail = "") {
  currentStatus = { state, detail };
}

function execCommand(cmd, timeoutMs = 20000) {
  return new Promise((resolve) => {
    exec(
      cmd,
      { cwd: GOCAB_ROOT, shell: "powershell.exe", timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
        const clipped =
          combined.length > MAX_TOOL_OUTPUT_CHARS
            ? combined.slice(0, MAX_TOOL_OUTPUT_CHARS) + "\n...[truncated for context efficiency]"
            : combined;
        resolve(
          err
            ? `EXIT ${err.code ?? 1}: ${clipped || err.message}`
            : clipped || "(command succeeded with no output)"
        );
      }
    );
  });
}

async function captureScreenDataUrl() {
  const tmpFile = path.join(__dirname, ".last_screen.jpg");
  const ps = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$scaled = New-Object System.Drawing.Bitmap(1280, 720)
$g2 = [System.Drawing.Graphics]::FromImage($scaled)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.DrawImage($bmp, 0, 0, 1280, 720)
$scaled.Save('${tmpFile.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Jpeg)
$g2.Dispose(); $scaled.Dispose(); $g.Dispose(); $bmp.Dispose()
Write-Output ($b.Width.ToString() + "x" + $b.Height.ToString())
`;
  const dims = await execCommand(ps, 10000);
  if (!fs.existsSync(tmpFile)) return { dataUrl: null, dims };
  const b64 = fs.readFileSync(tmpFile).toString("base64");
  return { dataUrl: `data:image/jpeg;base64,${b64}`, dims };
}

function startClickWatcher() {
  if (clickWatcherProc) return;
  const psScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class MuseWatch {
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  public struct POINT { public int X; public int Y; }
}
"@
$wasDown = $false
while ($true) {
  Start-Sleep -Milliseconds 120
  $state = [MuseWatch]::GetAsyncKeyState(0x01)
  $isDown = ($state -band 0x8000) -ne 0
  if ($isDown -and -not $wasDown) {
    $pt = New-Object MuseWatch+POINT
    [MuseWatch]::GetCursorPos([ref]$pt) | Out-Null
    $sb = New-Object System.Text.StringBuilder 256
    $h = [MuseWatch]::GetForegroundWindow()
    [MuseWatch]::GetWindowText($h, $sb, 256) | Out-Null
    $title = $sb.ToString()
    if ($title) { Write-Output ("CLICK|" + $pt.X + "," + $pt.Y + "|" + $title) }
  }
  $wasDown = $isDown
}
`;
  clickWatcherProc = spawn("powershell.exe", ["-NoProfile", "-Command", psScript], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  clickWatcherProc.stdout.on("data", (chunk) => {
    const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      if (line.startsWith("CLICK|")) {
        const [, coords, title] = line.split("|");
        const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        clickBreadcrumbs.push(`${time} Click (${coords}) in "${(title || "").slice(0, 60)}"`);
        if (clickBreadcrumbs.length > MAX_CLICK_LOG) {
          clickBreadcrumbs = clickBreadcrumbs.slice(-MAX_CLICK_LOG);
        }
      }
    }
  });
}

function stopClickWatcher() {
  if (clickWatcherProc) {
    try {
      clickWatcherProc.kill();
    } catch {}
    clickWatcherProc = null;
  }
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "see_screen",
      description: "Capture the user's current screen (1280x720) and recent click breadcrumbs.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "mouse_click",
      description: "Move cursor to (x, y) in 1280x720 screenshot coordinates and click.",
      parameters: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
          button: { type: "string", enum: ["left", "right", "double"] },
        },
        required: ["x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "type_text",
      description: "Type text into the currently focused window on the user's PC.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          pressEnter: { type: "boolean" },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "press_key",
      description: "Send a keyboard shortcut (SendKeys syntax, e.g. '{ENTER}', '^c', '%{TAB}').",
      parameters: {
        type: "object",
        properties: { keys: { type: "string" } },
        required: ["keys"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Execute a short PowerShell command in the GoCab workspace.",
      parameters: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_gocab_sla",
      description: "Run the GoCab Executive Watchdog SLA check.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "open_url",
      description: "Open a URL in the user's default browser.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    },
  },
];

async function executeTool(name, args) {
  if (name === "see_screen") {
    setStatus("working", "Looking at screen...");
    const { dataUrl, dims } = await captureScreenDataUrl();
    return {
      text: `Screen ${dims} (coords in 1280x720). Recent clicks: ${
        clickBreadcrumbs.length ? clickBreadcrumbs.join(" | ") : "none recorded"
      }`,
      imageDataUrl: dataUrl,
    };
  }
  if (name === "mouse_click") {
    setStatus("working", `Clicking (${args.x}, ${args.y})...`);
    const btn = args.button || "left";
    const clickCmd =
      btn === "right"
        ? "[MuseInput]::mouse_event(0x08,0,0,0,0); Start-Sleep -Milliseconds 40; [MuseInput]::mouse_event(0x10,0,0,0,0)"
        : btn === "double"
        ? "[MuseInput]::mouse_event(0x02,0,0,0,0); [MuseInput]::mouse_event(0x04,0,0,0,0); Start-Sleep -Milliseconds 60; [MuseInput]::mouse_event(0x02,0,0,0,0); [MuseInput]::mouse_event(0x04,0,0,0,0)"
        : "[MuseInput]::mouse_event(0x02,0,0,0,0); Start-Sleep -Milliseconds 40; [MuseInput]::mouse_event(0x04,0,0,0,0)";
    const ps = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class MuseInput { [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y); [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo); }'
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$tx = [int][Math]::Round((${Number(args.x) || 0} / 1280.0) * $b.Width)
$ty = [int][Math]::Round((${Number(args.y) || 0} / 720.0) * $b.Height)
[MuseInput]::SetCursorPos($tx, $ty) | Out-Null
Start-Sleep -Milliseconds 60
${clickCmd}
Write-Output ("CLICKED " + $tx + "," + $ty)
`;
    return { text: await execCommand(ps, 8000) };
  }
  if (name === "type_text") {
    setStatus("working", "Typing...");
    const escaped = String(args.text || "")
      .replace(/'/g, "''")
      .replace(/([+^%~(){}[\]])/g, "{$1}");
    const enterSuffix = args.pressEnter ? "{ENTER}" : "";
    const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}${enterSuffix}')`;
    return { text: await execCommand(ps, 8000) };
  }
  if (name === "press_key") {
    setStatus("working", `Pressing ${args.keys || ""}...`);
    const escaped = String(args.keys || "").replace(/'/g, "''");
    const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')`;
    return { text: await execCommand(ps, 8000) };
  }
  if (name === "check_gocab_sla") {
    setStatus("working", "Checking GoCab SLA...");
    return { text: await execCommand("node --import tsx scripts/executive-watchdog.ts", 25000) };
  }
  if (name === "run_command") {
    setStatus("working", `Running: ${(args.command || "").slice(0, 32)}...`);
    return { text: await execCommand(args.command || "") };
  }
  if (name === "open_url") {
    if (args.url && /^https?:\/\//i.test(args.url)) {
      await execCommand(`Start-Process '${args.url.replace(/'/g, "''")}'`, 5000);
      return { text: `Opened ${args.url}` };
    }
    return { text: "Invalid URL." };
  }
  return { text: "Unknown tool." };
}

const SYSTEM_PROMPT = `You are Muse, a fast personal voice AI assistant on the user's Windows PC (GoCab workspace: ${GOCAB_ROOT}).
Rules:
- Reply in 1-3 short, spoken-friendly sentences.
- When asked about what is on screen or to click/type/do something on their PC, call see_screen first, then mouse_click / type_text / press_key.
- Keep context minimal: screenshots are ephemeral for the current turn only.`;

async function callGateway(messages) {
  const apiKey = loadEnvKey("AI_GATEWAY_API_KEY");
  if (!apiKey) throw new Error("AI_GATEWAY_API_KEY missing in .env.local");
  const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      tools: TOOLS,
      temperature: 0.25,
      max_tokens: 450,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `AI Gateway HTTP ${res.status}`);
  if (json?.usage?.total_tokens) totalTokensUsed += json.usage.total_tokens;
  return json.choices[0].message;
}

async function handleAsk(userPrompt) {
  setStatus("working", "Thinking...");
  try {
    rollingHistory.push({ role: "user", content: userPrompt });
    if (rollingHistory.length > MAX_HISTORY_MESSAGES) {
      rollingHistory = rollingHistory.slice(-MAX_HISTORY_MESSAGES);
    }
    let loopMessages = [...rollingHistory];
    let finalReply = "";
    for (let step = 0; step < 6; step++) {
      const msg = await callGateway(loopMessages);
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        loopMessages.push(msg);
        let pendingImageUrl = null;
        for (const tc of msg.tool_calls) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || "{}");
          } catch {}
          const result = await executeTool(tc.function.name, parsedArgs);
          loopMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: String(result.text || ""),
          });
          if (result.imageDataUrl) pendingImageUrl = result.imageDataUrl;
        }
        if (pendingImageUrl) {
          loopMessages.push({
            role: "user",
            content: [
              { type: "text", text: "Current 1280x720 screenshot:" },
              { type: "image_url", image_url: { url: pendingImageUrl } },
            ],
          });
        }
      } else {
        finalReply = msg.content || "Done.";
        break;
      }
    }
    if (!finalReply) finalReply = "Task completed.";
    rollingHistory.push({ role: "assistant", content: finalReply });
    if (rollingHistory.length > MAX_HISTORY_MESSAGES) {
      rollingHistory = rollingHistory.slice(-MAX_HISTORY_MESSAGES);
    }
    setStatus("idle", finalReply);
    return {
      ok: true,
      reply: finalReply,
      turns: Math.ceil(rollingHistory.length / 2),
      maxTurns: MAX_HISTORY_MESSAGES / 2,
      totalTokensUsed,
    };
  } catch (err) {
    setStatus("error", err.message || "Error");
    return { ok: false, error: err.message || "Request failed" };
  }
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(html);
  }
  if (req.method === "GET" && req.url === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(currentStatus));
  }
  if (req.method === "POST" && req.url === "/api/ask") {
    const body = await readJsonBody(req);
    const out = await handleAsk(body.prompt || "");
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(out));
  }
  if (req.method === "POST" && req.url === "/api/follow-clicks") {
    const body = await readJsonBody(req);
    if (body.enabled) startClickWatcher();
    else stopClickWatcher();
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, enabled: Boolean(body.enabled) }));
  }
  if (req.method === "POST" && req.url === "/api/clear") {
    rollingHistory = [];
    clickBreadcrumbs = [];
    totalTokensUsed = 0;
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }
  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Muse AI Server running on http://127.0.0.1:${PORT}`);
});
