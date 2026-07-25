// Combined single service: serves the Vite/React frontend from /dist AND runs the
// blog engine (API + scheduler) from ./server/index.js in the same process.
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { app, startCron, ensureAuth } from "./server/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, "dist");

// Static assets for the site
app.use(express.static(distPath));

// SPA fallback — registered AFTER the engine's /health, /sitemap.xml and /api/* routes,
// so those still work; everything else returns index.html for react-router.
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Start the blog engine scheduler, then serve everything on Render's port.
startCron();
const port = process.env.PORT || 10000;
app.listen(port, async () => {
  await ensureAuth();
  console.log(`Site + blog engine listening on ${port}`);
});
