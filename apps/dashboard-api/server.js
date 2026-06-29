import express from "express";
import routes from "./src/routes.js";

const app = express();
const PORT = process.env.PORT || 3100;

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());
app.use("/api", routes);

app.use((err, req, res, next) => {
  console.error("[DASHBOARD-API]", err.message);
  res.status(500).json({ message: err.message });
});

app.listen(PORT, () => {
  console.log(`[DASHBOARD-API] Listening on ${PORT}`);
});
