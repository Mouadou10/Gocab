const { app, BrowserWindow, ipcMain, screen, globalShortcut, shell, desktopCapturer } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { exec, spawn } = require("node:child_process");

// Prevent Windows laptop GPU compositing black/blank window issues
app.disableHardwareAcceleration();

const GOCAB_ROOT = path.resolve(__dirname, "..");
const MAX_HISTORY_MESSAGES = 12; // 6 rolling turns max to keep context window tiny
const MAX_TOOL_OUTPUT_CHARS = 2200;
const MAX_CLICK_LOG = 5;

let mainWindow = null;
let rollingHistory = [];
let totalTokensUsed = 0;
let clickBreadcrumbs = [];
let clickWatcherProc = null;

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

function sendStatus(state, detail = "") {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("agent:status", { state, detail });
  }
}

function execCommand(cmd, timeoutMs = 20000) {
  return new Promise((resolve) => {
    exec(
      cmd,
      { cwd: GOCAB_ROOT, shell: "powershell.exe", timeout: timeoutMs, maxBuffer: 1024 * 1024 },
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

function getScreenMetrics() {
  const primary = screen.getPrimaryDisplay();
  const scale = primary.scaleFactor || 1;
  return {
    logicalWidth: primary.size.width,
    logicalHeight: primary.size.height,
    physicalWidth: Math.round(primary.size.width * scale),
    physicalHeight: Math.round(primary.size.height * scale),
    scaleFactor: scale,
  };
}

async function captureScreenDataUrl() {
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: 1280, height: 720 },
  });
  const primary = sources[0];
  if (!primary) return null;
  const jpg = primary.thumbnail.toJPEG(68);
  return `data:image/jpeg;base64,${jpg.toString("base64")}`;
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
      description:
        "Capture the user's current screen (1280x720) and recent click breadcrumbs to see what is on screen right now.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "mouse_click",
      description:
        "Move cursor to (x, y) in 1280x720 screenshot coordinates (automatically scaled to physical screen pixels) and click.",
      parameters: {
        type: "object",
        properties: {
          x: { type: "number", description: "X coordinate in 0..1280 screenshot space" },
          y: { type: "number", description: "Y coordinate in 0..720 screenshot space" },
          button: { type: "string", enum: ["left", "right", "double"], description: "Click type" },
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
          pressEnter: { type: "boolean", description: "Press Enter after typing" },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "press_key",
      description: "Send a keyboard shortcut or key (SendKeys syntax, e.g. '{ENTER}', '^c', '%{TAB}').",
      parameters: {
        type: "object",
        properties: {
          keys: { type: "string" },
        },
        required: ["keys"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Execute a short, non-destructive PowerShell command in the GoCab workspace.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file_lines",
      description: "Read a specific line range (max 80 lines) of a file in the GoCab workspace.",
      parameters: {
        type: "object",
        properties: {
          relativePath: { type: "string" },
          startLine: { type: "integer" },
          endLine: { type: "integer" },
        },
        required: ["relativePath", "startLine", "endLine"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_gocab_sla",
      description: "Run the GoCab Executive Watchdog SLA check across Vehicles, Collections, and Cloud WAL.",
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
        properties: {
          url: { type: "string" },
        },
        required: ["url"],
      },
    },
  },
];

async function executeTool(name, args) {
  if (name === "see_screen") {
    sendStatus("working", "Looking at screen...");
    const dataUrl = await captureScreenDataUrl();
    const metrics = getScreenMetrics();
    return {
      text: `Screen ${metrics.physicalWidth}x${metrics.physicalHeight} (coords in 1280x720). Recent clicks: ${
        clickBreadcrumbs.length ? clickBreadcrumbs.join(" | ") : "none recorded"
      }`,
      imageDataUrl: dataUrl,
    };
  }
  if (name === "mouse_click") {
    const metrics = getScreenMetrics();
    const targetX = Math.round(((Number(args.x) || 0) / 1280) * metrics.physicalWidth);
    const targetY = Math.round(((Number(args.y) || 0) / 720) * metrics.physicalHeight);
    const btn = args.button || "left";
    sendStatus("working", `Clicking (${targetX}, ${targetY})...`);
    const clickCmd =
      btn === "right"
        ? "[MuseInput]::mouse_event(0x08,0,0,0,0); Start-Sleep -Milliseconds 40; [MuseInput]::mouse_event(0x10,0,0,0,0)"
        : btn === "double"
        ? "[MuseInput]::mouse_event(0x02,0,0,0,0); [MuseInput]::mouse_event(0x04,0,0,0,0); Start-Sleep -Milliseconds 60; [MuseInput]::mouse_event(0x02,0,0,0,0); [MuseInput]::mouse_event(0x04,0,0,0,0)"
        : "[MuseInput]::mouse_event(0x02,0,0,0,0); Start-Sleep -Milliseconds 40; [MuseInput]::mouse_event(0x04,0,0,0,0)";
    const ps = `
Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class MuseInput { [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y); [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo); }'
[MuseInput]::SetCursorPos(${targetX}, ${targetY}) | Out-Null
Start-Sleep -Milliseconds 60
${clickCmd}
`;
    const out = await execCommand(ps, 8000);
    return { text: `Clicked ${btn} at (${targetX}, ${targetY}). ${out}` };
  }
  if (name === "type_text") {
    sendStatus("working", "Typing...");
    const escaped = String(args.text || "")
      .replace(/'/g, "''")
      .replace(/([+^%~(){}[\]])/g, "{$1}");
    const enterSuffix = args.pressEnter ? "{ENTER}" : "";
    const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}${enterSuffix}')`;
    const out = await execCommand(ps, 8000);
    return { text: `Typed text. ${out}` };
  }
  if (name === "press_key") {
    sendStatus("working", `Pressing ${args.keys || ""}...`);
    const escaped = String(args.keys || "").replace(/'/g, "''");
    const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')`;
    const out = await execCommand(ps, 8000);
    return { text: `Sent key ${args.keys}. ${out}` };
  }
  if (name === "check_gocab_sla") {
    sendStatus("working", "Checking GoCab SLA...");
    return { text: await execCommand("node --import tsx scripts/executive-watchdog.ts", 25000) };
  }
  if (name === "run_command") {
    sendStatus("working", `Running: ${(args.command || "").slice(0, 32)}...`);
    return { text: await execCommand(args.command || "") };
  }
  if (name === "read_file_lines") {
    const safePath = path.resolve(GOCAB_ROOT, args.relativePath || "");
    if (!safePath.startsWith(GOCAB_ROOT) || !fs.existsSync(safePath)) {
      return { text: "File not found or outside workspace." };
    }
    const start = Math.max(1, Number(args.startLine) || 1);
    const end = Math.min(start + 79, Number(args.endLine) || start + 40);
    const lines = fs.readFileSync(safePath, "utf8").split(/\r?\n/);
    return {
      text: lines
        .slice(start - 1, end)
        .map((l, idx) => `${start + idx}: ${l}`)
        .join("\n")
        .slice(0, MAX_TOOL_OUTPUT_CHARS),
    };
  }
  if (name === "open_url") {
    if (args.url && /^https?:\/\//i.test(args.url)) {
      await shell.openExternal(args.url);
      return { text: `Opened ${args.url}` };
    }
    return { text: "Invalid URL." };
  }
  return { text: "Unknown tool." };
}

const SYSTEM_PROMPT = `You are Muse, a fast personal voice AI assistant running as a floating pill on the user's Windows PC (GoCab workspace: ${GOCAB_ROOT}).
Rules:
- Reply in 1-3 short, spoken-friendly sentences (the UI reads your reply aloud).
- When the user asks about what is on screen, or asks you to click/type/do something on their PC, call see_screen first so you see the exact UI in 1280x720 coordinates, then use mouse_click / type_text / press_key.
- Keep context minimal: screenshots are ephemeral (current turn only) and never read whole files.`;

async function callGateway(messages) {
  const apiKey = loadEnvKey("AI_GATEWAY_API_KEY");
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY missing in .env.local");
  }
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
  if (!res.ok) {
    throw new Error(json?.error?.message || `AI Gateway HTTP ${res.status}`);
  }
  if (json?.usage?.total_tokens) {
    totalTokensUsed += json.usage.total_tokens;
  }
  return json.choices[0].message;
}

ipcMain.handle("agent:ask", async (_event, userPrompt) => {
  sendStatus("working", "Thinking...");
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
          if (result.imageDataUrl) {
            pendingImageUrl = result.imageDataUrl;
          }
        }
        // Inject ephemeral screenshot only into loopMessages (never stored in rollingHistory!)
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

    sendStatus("idle", "Ready");
    return {
      ok: true,
      reply: finalReply,
      turns: Math.ceil(rollingHistory.length / 2),
      maxTurns: MAX_HISTORY_MESSAGES / 2,
      totalTokensUsed,
    };
  } catch (err) {
    sendStatus("error", err.message || "Error");
    return { ok: false, error: err.message || "Request failed" };
  }
});

ipcMain.handle("agent:follow-clicks", (_event, enabled) => {
  if (enabled) startClickWatcher();
  else stopClickWatcher();
  return { ok: true, enabled: Boolean(enabled) };
});

ipcMain.handle("agent:clear", () => {
  rollingHistory = [];
  clickBreadcrumbs = [];
  totalTokensUsed = 0;
  return { ok: true };
});

ipcMain.handle("agent:stats", () => ({
  turns: Math.ceil(rollingHistory.length / 2),
  maxTurns: MAX_HISTORY_MESSAGES / 2,
  totalTokensUsed,
}));

function positionTopCenter(width, height) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;
  const x = Math.round((screenW - width) / 2);
  mainWindow.setBounds({ x, y: 10, width, height }, true);
}

ipcMain.on("pill:resize", (_e, expanded) => {
  if (expanded) {
    positionTopCenter(456, 456);
  } else {
    positionTopCenter(456, 164);
  }
});

ipcMain.on("pill:close", () => {
  stopClickWatcher();
  app.quit();
});

function createWindow() {
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;
  const initW = 440;
  const initH = 148;
  mainWindow = new BrowserWindow({
    width: initW,
    height: initH,
    x: Math.round((screenW - initW) / 2),
    y: 12,
    frame: false,
    transparent: false,
    backgroundColor: "#0d2830",
    roundedCorners: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.once("ready-to-show", () => {
    mainWindow.setAlwaysOnTop(true, "screen-saver");
    mainWindow.show();
    mainWindow.moveTop();
  });

  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.setAlwaysOnTop(true, "screen-saver");
    }
  }, 5000);
}

app.whenReady().then(() => {
  createWindow();
  globalShortcut.register("Alt+M", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("hotkey:toggle-mic");
    }
  });
});

app.on("will-quit", () => {
  stopClickWatcher();
  globalShortcut.unregisterAll();
});
