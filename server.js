// Minimal web server to run the Vite/React frontend as a Render Web Service.
// Serves the production build in /dist and falls back to index.html for SPA routing.
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const distPath = path.join(__dirname, "dist");

app.use(express.static(distPath));

// SPA fallback — every non-file route returns index.html so react-router works
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Frontend web service listening on ${port}`));
