import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

try { process.loadEnvFile(); } catch {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.TRANSCRIBE_MODEL || "whisper-large-v3-turbo";
const LANGUAGE = process.env.TRANSCRIBE_LANGUAGE || "";
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const MAX_BYTES = 25 * 1024 * 1024; // limite de l'API : 25 Mo

if (!API_KEY) {
  console.error("Clé API manquante : renseigne GROQ_API_KEY dans le fichier .env");
  process.exit(1);
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error("TOO_LARGE");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function transcribe(req, res) {
  let audio;
  try {
    audio = await readBody(req);
  } catch (e) {
    if (e.message === "TOO_LARGE") {
      return send(res, 413, { error: "Fichier trop lourd (25 Mo maximum)." });
    }
    return send(res, 400, { error: "Lecture du fichier impossible." });
  }
  if (!audio.length) return send(res, 400, { error: "Fichier vide." });

  const filename = decodeURIComponent(req.headers["x-filename"] || "audio");
  const mimeByExt = {
    mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "audio/mp4",
    wav: "audio/wav", ogg: "audio/ogg", webm: "audio/webm",
    flac: "audio/flac", mpeg: "audio/mpeg", mpga: "audio/mpeg",
  };
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const mime = mimeByExt[ext] || "application/octet-stream";
  const form = new FormData();
  form.append("file", new Blob([audio], { type: mime }), filename);
  form.append("model", MODEL);
  if (LANGUAGE) form.append("language", LANGUAGE);

  try {
    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}` },
      body: form,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("Erreur API :", r.status, data);
      return send(res, 502, {
        error: data?.error?.message || `Le service de transcription a répondu ${r.status}.`,
      });
    }
    return send(res, 200, { text: data.text ?? "" });
  } catch (e) {
    console.error(e);
    return send(res, 502, { error: "Impossible de joindre le service de transcription." });
  }
}

function authorized(req) {
  if (!APP_PASSWORD) return true;
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return false;
  const decoded = Buffer.from(h.slice(6), "base64").toString();
  return decoded.slice(decoded.indexOf(":") + 1) === APP_PASSWORD;
}

const server = http.createServer(async (req, res) => {
  if (!authorized(req)) {
    res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Bonjour Mylene", charset="UTF-8"' });
    return res.end("Mot de passe requis.");
  }
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    const html = await readFile(path.join(__dirname, "index.html"), "utf8");
    return send(res, 200, html, "text/html; charset=utf-8");
  }
  if (req.method === "POST" && req.url === "/transcribe") return transcribe(req, res);
  send(res, 404, { error: "Introuvable." });
});

server.listen(PORT, () => console.log(`Bonjour Mylène → http://localhost:${PORT}`));
