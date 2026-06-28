import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  Bell,
  Clock3,
  Database,
  RefreshCw,
  Server,
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3100/api";

//Shorthand function for getting response from backend
async function getJson(path) {
  const response = await fetch(`${API_URL}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed ${response.status}`);
  }

  return response.json();
}

function formatDate(value) {
  if (!value) {
    return "null";
  }

  return new Date(value).toLocaleString();
}
//Class function for severity
function severityClass(severity) {
  return `severity severity-${String(severity || "P3").toLowerCase()}`;
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="stat">
      <div className="stat-icon">
        <Icon size={18} />
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function IncidentList({ incidents, selectedId, onSelect }) {
  return (
    <section className="panel list-panel">
      <div className="panel-heading">
        <h2>Open Incidents</h2>
        <span>{incidents.length}</span>
      </div>
      <div className="incident-list">
        {incidents.length === 0 ? (
          <div className="empty">No incidents found.</div>
        ) : incidents.map((incident) => (
          <button
            className={`incident-row ${incident.id === selectedId ? "selected" : ""}`}
            key={incident.id}
            onClick={() => onSelect(incident.id)}
          >
            <span className={severityClass(incident.severity)}>{incident.severity}</span>
            <span className="incident-main">
              <strong>{incident.event_type}</strong>
              <span>{incident.service_name}</span>
            </span>
            <span className="incident-time">{formatDate(incident.updated_at || incident.opened_at)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function IncidentDetail({ incident }) {
  const recommendations = Array.isArray(incident?.recommendations)
    ? incident.recommendations
    : [];

  return (
    <section className="panel detail-panel">
      {!incident ? (
        <div className="empty">Select an incident.</div>
      ) : (
        <>
          <div className="detail-header">
            <div>
              <div className="eyebrow">Incident #{incident.id}</div>
              <h2>{incident.event_type} on {incident.service_name}</h2>
            </div>
            <span className={severityClass(incident.severity)}>{incident.severity}</span>
          </div>

          <div className="detail-grid">
            <div>
              <span>Status</span>
              <strong>{incident.status}</strong>
            </div>
            <div>
              <span>Metric</span>
              <strong>{incident.metric_value ?? "n/a"}</strong>
            </div>
            <div>
              <span>Detected</span>
              <strong>{formatDate(incident.detected_at)}</strong>
            </div>
            <div>
              <span>AI</span>
              <strong>{incident.provider || "n/a"} {incident.model || ""}</strong>
            </div>
          </div>

          <div className="detail-block">
            <h3>Root Cause</h3>
            <p>{incident.root_cause || "No root cause available."}</p>
          </div>

          <div className="detail-block">
            <h3>Recommendations</h3>
            {recommendations.length === 0 ? (
              <p>No recommendations available.</p>
            ) : (
              <ol>
                {recommendations.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ol>
            )}
          </div>

          <div className="detail-block">
            <h3>Alert History</h3>
            <div className="mini-list">
              {(incident.alerts || []).length === 0 ? (
                <p>No alerts emitted.</p>
              ) : incident.alerts.map((alert) => (
                <div className="mini-row" key={alert.id}>
                  <span className={severityClass(alert.severity)}>{alert.severity}</span>
                  <span>{alert.status} via {alert.channel}</span>
                  <time>{formatDate(alert.created_at)}</time>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function AlertFeed({ alerts }) {
  return (
    <section className="panel alert-panel">
      <div className="panel-heading">
        <h2>Recent Alerts</h2>
        <Bell size={17} />
      </div>
      <div className="alert-feed">
        {alerts.length === 0 ? (
          <div className="empty">No alerts found.</div>
        ) : alerts.slice(0, 10).map((alert) => (
          <div className="alert-row" key={alert.id}>
            <span className={severityClass(alert.severity)}>{alert.severity}</span>
            <div>
              <strong>{alert.event_type} on {alert.service_name}</strong>
              <p>{alert.message.split("\n").slice(3).join(" ")}</p>
              <time>{formatDate(alert.created_at)}</time>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [summary, setSummary] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    setError("");
    setLoading(true);

    try {
      const [summaryData, incidentData, alertData] = await Promise.all([
        getJson("/summary"),
        getJson("/incidents"),
        getJson("/alerts"),
      ]);

      setSummary(summaryData);
      setIncidents(incidentData);
      setAlerts(alertData);

      const nextId = selectedId || incidentData[0]?.id || null;
      setSelectedId(nextId);

      if (nextId) {
        setSelectedIncident(await getJson(`/incidents/${nextId}`));
      }
    }
    catch (err) {
      setError(err.message);
    }
    finally {
      setLoading(false);
    }
  }

  async function selectIncident(id) {
    setSelectedId(id);
    setSelectedIncident(await getJson(`/incidents/${id}`));
  }

  useEffect(() => {
    loadDashboard();
    const timer = setInterval(loadDashboard, 30000);

    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    return {
      open: summary?.incidents?.open ?? 0,
      p1: summary?.incidents?.p1 ?? 0,
      p2: summary?.incidents?.p2 ?? 0,
      alerts: summary?.alertsLast24h ?? 0,
    };
  }, [summary]);

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">AIOps Operations</div>
          <h1>Incident Dashboard</h1>
        </div>
        <button className="icon-button" onClick={loadDashboard} disabled={loading} title="Refresh dashboard">
          <RefreshCw size={18} />
          <span>Refresh</span>
        </button>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="stats-grid">
        <Stat icon={Activity} label="Open incidents" value={stats.open} />
        <Stat icon={AlertTriangle} label="P1 incidents" value={stats.p1} />
        <Stat icon={Server} label="P2 incidents" value={stats.p2} />
        <Stat icon={Clock3} label="Alerts in 24h" value={stats.alerts} />
      </section>

      <section className="workspace">
        <IncidentList
          incidents={incidents}
          selectedId={selectedId}
          onSelect={selectIncident}
        />
        <IncidentDetail incident={selectedIncident} />
        <AlertFeed alerts={alerts} />
      </section>

      <footer>
        <Database size={15} />
        <span>API: {API_URL}</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
