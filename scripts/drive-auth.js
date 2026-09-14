const http = require("http");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    val = val.replace(/\\n/g, "\n");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_DRIVE_REDIRECT_URI || "http://localhost:5556/oauth2callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("\nMissing GOOGLE_DRIVE_CLIENT_ID or GOOGLE_DRIVE_CLIENT_SECRET in .env.local");
  console.error("Add them locally first, then run this script again.\n");
  process.exit(1);
}

let redirect;
try {
  redirect = new URL(REDIRECT_URI);
} catch {
  console.error("\nInvalid GOOGLE_DRIVE_REDIRECT_URI:", REDIRECT_URI);
  process.exit(1);
}

if (redirect.hostname !== "localhost" && redirect.hostname !== "127.0.0.1") {
  console.error("\nFor this reconnect utility, GOOGLE_DRIVE_REDIRECT_URI must be localhost.");
  console.error("Recommended: http://localhost:5556/oauth2callback\n");
  process.exit(1);
}

const port = Number(redirect.port || 5556);
const callbackPath = redirect.pathname || "/oauth2callback";
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const scopes = ["https://www.googleapis.com/auth/drive"];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: scopes,
  include_granted_scopes: true,
});

function openBrowser(url) {
  const safe = url.replace(/"/g, '\\"');
  const cmd =
    process.platform === "win32"
      ? `start "" "${safe}"`
      : process.platform === "darwin"
      ? `open "${safe}"`
      : `xdg-open "${safe}"`;
  exec(cmd, () => {});
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, `http://localhost:${port}`);

    if (reqUrl.pathname !== callbackPath) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }

    const error = reqUrl.searchParams.get("error");
    if (error) {
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<h2>Google authorization failed</h2><p>${error}</p><p>You can close this tab.</p>`);
      console.error("\nGoogle authorization failed:", error);
      server.close();
      return;
    }

    const code = reqUrl.searchParams.get("code");
    if (!code) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Authorization code missing.");
      return;
    }

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h2>No refresh token returned</h2><p>Re-run the utility and approve access again.</p>");
      console.error("\nNo refresh token was returned.");
      console.error("Run the script again. It already requests prompt=consent.");
      server.close();
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:60px auto;padding:24px">
        <h2>StayFinder Google Drive connected</h2>
        <p>Return to CMD. Your new refresh token is printed there.</p>
        <p>Do not share the token with anyone.</p>
        <p>You can close this tab.</p>
      </div>
    `);

    console.log("\n==============================================================");
    console.log("SUCCESS - NEW GOOGLE DRIVE REFRESH TOKEN");
    console.log("==============================================================\n");
    console.log(tokens.refresh_token);
    console.log("\n==============================================================");
    console.log("Copy ONLY the token above.");
    console.log("Vercel -> Environment Variables -> GOOGLE_DRIVE_REFRESH_TOKEN");
    console.log("Replace the old value, save for Production, then Redeploy.");
    console.log("==============================================================\n");

    server.close();
  } catch (err) {
    console.error("\nOAuth callback error:", err?.message || err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Authorization failed. Check CMD.");
    server.close();
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log("\nStayFinder Google Drive reconnect");
  console.log("--------------------------------");
  console.log("Callback:", REDIRECT_URI);
  console.log("A Google permission page will open in your browser.");
  console.log("Use the Google account whose Drive stores StayFinder photos.\n");
  console.log("If the browser does not open automatically, copy this URL:\n");
  console.log(authUrl);
  console.log("");
  openBrowser(authUrl);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\nPort ${port} is already in use.`);
    console.error("Close the program using it and run the script again.\n");
  } else {
    console.error("\nServer error:", err.message);
  }
  process.exit(1);
});
