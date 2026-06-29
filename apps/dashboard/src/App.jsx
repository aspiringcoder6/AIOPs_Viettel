import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Database, RefreshCw } from "lucide-react";
import { AlertFeed } from "./components/AlertFeed";
import { FilterBar } from "./components/FilterBar";
import { IncidentDetail } from "./components/IncidentDetail";
import { IncidentList } from "./components/IncidentList";
import { StatCard } from "./components/StatCard";
import { API_URL, requestJson } from "./utils/dashboard";

export default function App() {
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
      const statusMatches = filters.status === "ALL" || incident.status === filters.status;
      const severityMatches = filters.severity === "ALL" || incident.severity === filters.severity;
      const serviceMatches = filters.service === "ALL" || incident.service_name === filters.service;

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
      } else {
        setSelectedIncident(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
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
      selectedId && filteredIncidents.some((incident) => incident.id === selectedId);

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
      await requestJson(`/incidents/${id}/${action}`, { method: "POST" });
      await loadDashboard(id);
    } catch (err) {
      setError(err.message);
    } finally {
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
          <div className="eyebrow">ATLAT (AI for Tracking, Logging and Automation Tool) </div>
          <h1>Incident Dashboard</h1>
        </div>
        <button className="icon-button" onClick={() => loadDashboard()} disabled={loading} title="Refresh dashboard">
          <RefreshCw size={18} />
          <span>Refresh</span>
        </button>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="stats-grid">
        <StatCard icon="Activity" label="Open incidents" value={stats.open} />
        <StatCard icon="CheckCircle2" label="Resolved incidents" value={stats.resolved} />
        <StatCard icon="AlertTriangle" label="P1 incidents" value={stats.p1} />
        <StatCard icon="Clock3" label="Alerts in 24h" value={stats.alerts} />
      </section>

      <FilterBar filters={filters} services={services} onChange={setFilters} />

      <section className="workspace">
        <IncidentList incidents={filteredIncidents} selectedId={selectedId} onSelect={selectIncident} />
        <IncidentDetail incident={selectedIncident} onLifecycleChange={changeLifecycle} actionBusy={actionBusy} />
        <AlertFeed alerts={alerts} />
      </section>

      <footer>
        <Database size={15} />
        <span>API: {API_URL}</span>
      </footer>
    </main>
  );
}
