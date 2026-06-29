import { Router } from "express";
import { pool } from "./db.js";

const router = Router();

router.get("/health", async (req, res) => {
  await pool.query("SELECT NOW()");
  res.json({ status: "ok" });
});

router.get("/summary", async (req, res, next) => {
  try {
    const [incidents, alerts, analyses] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open,
          COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved,
          COUNT(*) FILTER (WHERE severity = 'P1')::int AS p1,
          COUNT(*) FILTER (WHERE severity = 'P2')::int AS p2,
          COUNT(*) FILTER (WHERE severity = 'P3')::int AS p3
        FROM active_incidents
      `),
      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM alerts
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `),
      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM ai_analyses
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `),
    ]);

    res.json({
      incidents: incidents.rows[0],
      alertsLast24h: alerts.rows[0].total,
      analysesLast24h: analyses.rows[0].total,
    });
  }
  catch (err) {
    next(err);
  }
});

router.get("/incidents", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        event_type,
        service_name,
        severity,
        status,
        root_cause,
        recommendations,
        latest_event_id,
        latest_analysis_id,
        opened_at,
        updated_at,
        resolved_at
      FROM active_incidents
      ORDER BY
        CASE severity
          WHEN 'P1' THEN 1
          WHEN 'P2' THEN 2
          ELSE 3
        END,
        COALESCE(updated_at, opened_at) DESC
      LIMIT 100
    `);

    res.json(result.rows);
  }
  catch (err) {
    next(err);
  }
});

router.get("/incidents/:id", async (req, res, next) => {
  try {
    const incident = await pool.query(
      `
      SELECT
        i.*,
        e.description AS event_description,
        e.metric_value,
        e.detected_at,
        aa.confidence,
        aa.provider,
        aa.model,
        aa.created_at AS analyzed_at
      FROM active_incidents i
      LEFT JOIN events e
        ON e.id = i.latest_event_id
      LEFT JOIN ai_analyses aa
        ON aa.id = i.latest_analysis_id
      WHERE i.id = $1
      `,
      [req.params.id]
    );

    if (incident.rows.length === 0) {
      res.status(404).json({ message: "Incident not found" });
      return;
    }

    const alerts = await pool.query(
      `
      SELECT id, severity, channel, status, message, created_at
      FROM alerts
      WHERE incident_id = $1
      ORDER BY created_at DESC
      LIMIT 20
      `,
      [req.params.id]
    );

    res.json({
      ...incident.rows[0],
      alerts: alerts.rows,
    });
  }
  catch (err) {
    next(err);
  }
});

async function updateIncidentStatus(id, status) {
  const resolvedAt =
    status === "RESOLVED"
      ? "NOW()"
      : "NULL";

  const result = await pool.query(
    `
    UPDATE active_incidents
    SET
      status = $1,
      resolved_at = ${resolvedAt},
      updated_at = NOW()
    WHERE id = $2
    RETURNING *
    `,
    [
      status,
      id,
    ]
  );

  return result.rows[0] || null;
}

router.post("/incidents/:id/resolve", async (req, res, next) => {
  try {
    const incident = await updateIncidentStatus(req.params.id, "RESOLVED");

    if (!incident) {
      res.status(404).json({ message: "Incident not found" });
      return;
    }

    res.json(incident);
  }
  catch (err) {
    next(err);
  }
});

router.post("/incidents/:id/reopen", async (req, res, next) => {
  try {
    const incident = await updateIncidentStatus(req.params.id, "OPEN");

    if (!incident) {
      res.status(404).json({ message: "Incident not found" });
      return;
    }

    res.json(incident);
  }
  catch (err) {
    next(err);
  }
});

router.get("/alerts", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.incident_id,
        a.analysis_id,
        a.severity,
        a.channel,
        a.status,
        a.message,
        a.created_at,
        i.event_type,
        i.service_name
      FROM alerts a
      JOIN active_incidents i
        ON i.id = a.incident_id
      ORDER BY a.created_at DESC
      LIMIT 100
    `);

    res.json(result.rows);
  }
  catch (err) {
    next(err);
  }
});

export default router;
