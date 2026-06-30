import { formatDate, severityClass, statusClass } from "../utils/dashboard";

export function IncidentList({ incidents, selectedId, onSelect }) {
  return (
    <section className="panel list-panel">
      <div className="panel-heading">
        <h2>Incidents</h2>
        <span>{incidents.length}</span>
      </div>
      <div className="panel-body incident-list">
        {incidents.length === 0 ? (
          <div className="empty">No incidents match the current filters.</div>
        ) : (
          incidents.map((incident) => (
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
          ))
        )}
      </div>
    </section>
  );
}
