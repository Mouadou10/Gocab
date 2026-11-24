const { app, BrowserWindow, ipcMain, screen, globalShortcut, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { exec } = require("node:child_process");

const GOCAB_ROOT = path.resolve(__dirname, "..");
const MAX_HISTORY_MESSAGES = 12; // 6 rolling turns max to keep context window tiny
const MAX_TOOL_OUTPUT_CHARS = 2200;

let mainWindow = null;
let rollingHistory = [];
let totalTokensUsed = 0;

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

const TOOLS = [
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Execute a short, non-destructive PowerShell command in the GoCab workspace (e.g., check git status, run node scripts, list files). Avoid destructive commands.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "PowerShell command to execute" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file_lines",
      description:
        "Read a specific line range (max 80 lines) of a file in the GoCab workspace to save context.",
      parameters: {
        type: "object",
        properties: {
          relativePath: { type: "string", description: "Path relative to workspace root" },
          startLine: { type: "integer", description: "1-based start line" },
          endLine: { type: "integer", description: "1-based end line (max startLine + 79)" },
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
      description: "Open a URL in the user's default browser (e.g., https://gocab-psi.vercel.app).",
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
  if (name === "check_gocab_sla") {
    sendStatus("working", "Checking GoCab SLA...");
    return await execCommand("node --import tsx scripts/executive-watchdog.ts", 25000);
  }
  if (name === "run_command") {
    sendStatus("working", `Running: ${(args.command || "").slice(0, 32)}...`);
    return await execCommand(args.command || "");
  }
  if (name === "read_file_lines") {
    const safePath = path.resolve(GOCAB_ROOT, args.relativePath || "");
    if (!safePath.startsWith(GOCAB_ROOT) || !fs.existsSync(safePath)) {
      return "File not found or outside workspace.";
    }
    const start = Math.max(1, Number(args.startLine) || 1);
    const end = Math.min(start + 79, Number(args.endLine) || start + 40);
    const lines = fs.readFileSync(safePath, "utf8").split(/\r?\n/);
    return lines
      .slice(start - 1, end)
      .map((l, idx) => `${start + idx}: ${l}`)
      .join("\n")
      .slice(0, MAX_TOOL_OUTPUT_CHARS);
  }
  if (name === "open_url") {
    if (args.url && /^https?:\/\//i.test(args.url)) {
      await shell.openExternal(args.url);
      return `Opened ${args.url}`;
    }
    return "Invalid URL.";
  }
  return "Unknown tool.";
}

const SYSTEM_PROMPT = `You are Muse, a fast, ultra-concise personal voice AI assistant running as a floating pill on the user's Windows PC (GoCab workspace: ${GOCAB_ROOT}).
Rules:
- Reply in 1-3 short, spoken-friendly sentences (the UI reads your reply aloud).
- Use tools immediately when asked to check GoCab CRM, run scripts, inspect files, or open URLs.
- Keep context minimal: never ask to read whole files; read only exact line ranges.`;

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
      temperature: 0.3,
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

    for (let step = 0; step < 4; step++) {
      const msg = await callGateway(loopMessages);
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        loopMessages.push(msg);
        for (const tc of msg.tool_calls) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || "{}");
          } catch {}
          const result = await executeTool(tc.function.name, parsedArgs);
          loopMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: String(result),
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

ipcMain.handle("agent:clear", () => {
  rollingHistory = [];
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
    positionTopCenter(460, 440);
  } else {
    positionTopCenter(340, 66);
  }
});

ipcMain.on("pill:close", () => {
  app.quit();
});

function createWindow() {
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;
  const initW = 340;
  const initH = 66;
  mainWindow = new BrowserWindow({
    width: initW,
    height: initH,
    x: Math.round((screenW - initW) / 2),
    y: 10,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.loadFile(path.join(__dirname, "index.html"));
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
  globalShortcut.unregisterAll();
});
