const express = require("express");
const path = require("path");

const app = express();
const port = Number(process.env.PORT || 80);
const rootDir = __dirname;

app.disable("x-powered-by");
app.set("trust proxy", true);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  next();
});

app.get("/styles.css", (_req, res) => res.type("text/css").sendFile(path.join(rootDir, "styles.css")));
app.get("/lifescale-icon.svg", (_req, res) => res.type("image/svg+xml").sendFile(path.join(rootDir, "lifescale-icon.svg")));

const pages = {
  "/": "index.html",
  "/app": "index.html",
  "/app/": "index.html",
  "/privacy": "privacy.html",
  "/terms": "terms.html",
  "/third-parties": "third-parties.html",
  "/account-deletion": "account-deletion.html"
};

for (const [route, file] of Object.entries(pages)) {
  app.get(route, (_req, res) => res.sendFile(path.join(rootDir, file)));
}

app.get("/app/*", (_req, res) => res.sendFile(path.join(rootDir, "index.html")));
app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok", service: "lifescale-official-site" }));
app.use((_req, res) => res.status(404).sendFile(path.join(rootDir, "404.html")));

app.listen(port, "0.0.0.0", () => console.log(`LifeScale site listening on ${port}`));
