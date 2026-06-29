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
  CheckCircle2,
  Clock3,
  Database,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3100/api";

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);

  if (!response.ok) {
    throw new Error(`Request failed ${response.status}`);
  }

  return response.json();
}

function formatDate(value) {
  if (!value) {
    return "n/a";
  }

  return new Date(value).toLocaleString();
}

function severityClass(severity) {
  return `severity severity-${String(severity || "P3").toLowerCase()}`;
}

function statusClass(status) {
  return `status status-${String(status || "OPEN").toLowerCase()}`;
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

function FilterBar({
  filters,
  services,
  onChange,
}) {
  return (
    <section className="filterbar">
      <select
        value={filters.status}
        onChange={(event) => onChange({ ...filters, status: event.target.value })}
        aria-label="Filter by status"
      >
        <option value="OPEN">Open</option>
        <option value="RESOLVED">Resolved</option>
        <option value="ALL">All statuses</option>
      </select>

      <select
        value={filters.severity}
        onChange={(event) => onChange({ ...filters, severity: event.target.value })}
        aria-label="Filter by severity"
      >
        <option value="ALL">All severities</option>
        <option value="P1">P1</option>
        <option value="P2">P2</option>
        <option value="P3">P3</option>
      </select>

      <select
        value={filters.service}
        onChange={(event) => onChange({ ...filters, service: event.target.value })}
        aria-label="Filter by service"
      >
        <option value="ALL">All services</option>
        {services.map((service) => (
          <option key={service} value={service}>{service}</option>
        ))}
      </select>
    </section>
  );
}

function IncidentList({
  incidents,
  selectedId,
  onSelect,
}) {
  return (
    <section className="panel list-panel">
      <div className="panel-heading">
        <h2>Incidents</h2>
        <span>{incidents.length}</span>
      </div>
      <div className="incident-list">
        {incidents.length === 0 ? (
          <div className="empty">No incidents match the current filters.</div>
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
            <span className={statusClass(incident.status)}>{incident.status}</span>
            <span className="incident-time">
              {formatDate(incident.updated_at || incident.opened_at)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function IncidentDetail({
  incident,
  onLifecycleChange,
  actionBusy,
}) {
  const recommendations = Array.isArray(incident?.recommendations)
    ? incident.recommendations
    : [];
  const isResolved = incident?.status === "RESOLVED";

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
            <div className="detail-actions">
              <span className={severityClass(incident.severity)}>{incident.severity}</span>
              <button
                className={isResolved ? "secondary-button" : "resolve-button"}
                disabled={actionBusy}
                onClick={() => onLifecycleChange(incident.id, isResolved ? "reopen" : "resolve")}
                title={isResolved ? "Reopen incident" : "Resolve incident"}
              >
                {isResolved ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}
                <span>{isResolved ? "Reopen" : "Resolve"}</span>
              </button>
            </div>
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
              <span>Resolved</span>
              <strong>{formatDate(incident.resolved_at)}</strong>
            </div>
          </div>

          <div className="detail-grid detail-grid-secondary">
            <div>
              <span>AI Provider</span>
              <strong>{incident.provider || "n/a"}</strong>
            </div>
            <div>
              <span>Model</span>
              <strong>{incident.model || "n/a"}</strong>
            </div>
            <div>
              <span>Confidence</span>
              <strong>{incident.confidence ?? "n/a"}</strong>
            </div>
            <div>
              <span>Analyzed</span>
              <strong>{formatDate(incident.analyzed_at)}</strong>
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
  const [filters, setFilters] = useState({
    status: "OPEN",
    severity: "ALL",
    service: "ALL",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const statusMatches =
        filters.status === "ALL" ||
        incident.status === filters.status;
      const severityMatches =
        filters.severity === "ALL" ||
        incident.severity === filters.severity;
      const serviceMatches =
        filters.service === "ALL" ||
        incident.service_name === filters.service;

      return statusMatches && severityMatches && serviceMatches;
    });
  }, [incidents, filters]);

  const services = useMemo(() => {
    return [...new Set(incidents.map((incident) => incident.service_name))]
      .filter(Boolean)
      .sort();
  }, [incidents]);

  async function loadDashboard(preferredId = selectedId) {
    setError("");
    setLoading(true);

    try {
      const [summaryData, incidentData, alertData] = await Promise.all([
        requestJson("/summary"),
        requestJson("/incidents"),
        requestJson("/alerts"),
      ]);

      setSummary(summaryData);
      setIncidents(incidentData);
      setAlerts(alertData);

      const nextId =
        preferredId ||
        incidentData.find((incident) => incident.status === "OPEN")?.id ||
        incidentData[0]?.id ||
        null;

      setSelectedId(nextId);

      if (nextId) {
        setSelectedIncident(await requestJson(`/incidents/${nextId}`));
      }
      else {
        setSelectedIncident(null);
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
    setSelectedIncident(await requestJson(`/incidents/${id}`));
  }

  useEffect(() => {
    if (filteredIncidents.length === 0) {
      setSelectedId(null);
      setSelectedIncident(null);
      return;
    }

    const selectedIsVisible =
      selectedId &&
      filteredIncidents.some((incident) => incident.id === selectedId);

    if (!selectedIsVisible) {
      selectIncident(filteredIncidents[0].id).catch((err) => {
        setError(err.message);
      });
    }
  }, [filters, incidents]);

  async function changeLifecycle(id, action) {
    setActionBusy(true);
    setError("");

    try {
      await requestJson(`/incidents/${id}/${action}`, {
        method: "POST",
      });
      await loadDashboard(id);
    }
    catch (err) {
      setError(err.message);
    }
    finally {
      setActionBusy(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    const timer = setInterval(() => loadDashboard(), 30000);

    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    return {
      open: summary?.incidents?.open ?? 0,
      resolved: summary?.incidents?.resolved ?? 0,
      p1: summary?.incidents?.p1 ?? 0,
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
        <button className="icon-button" onClick={() => loadDashboard()} disabled={loading} title="Refresh dashboard">
          <RefreshCw size={18} />
          <span>Refresh</span>
        </button>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="stats-grid">
        <Stat icon={Activity} label="Open incidents" value={stats.open} />
        <Stat icon={CheckCircle2} label="Resolved incidents" value={stats.resolved} />
        <Stat icon={AlertTriangle} label="P1 incidents" value={stats.p1} />
        <Stat icon={Clock3} label="Alerts in 24h" value={stats.alerts} />
      </section>

      <FilterBar
        filters={filters}
        services={services}
        onChange={setFilters}
      />

      <section className="workspace">
        <IncidentList
          incidents={filteredIncidents}
          selectedId={selectedId}
          onSelect={selectIncident}
        />
        <IncidentDetail
          incident={selectedIncident}
          onLifecycleChange={changeLifecycle}
          actionBusy={actionBusy}
        />
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
