import { CheckCircle2, RotateCcw } from "lucide-react";
import { formatDate, severityClass } from "../utils/dashboard";

export function IncidentDetail({ incident, onLifecycleChange, actionBusy }) {
  const recommendations = Array.isArray(incident?.recommendations) ? incident.recommendations : [];
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
              <h2>
                {incident.event_type} on {incident.service_name}
              </h2>
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
              ) : (
                incident.alerts.map((alert) => (
                  <div className="mini-row" key={alert.id}>
                    <span className={severityClass(alert.severity)}>{alert.severity}</span>
                    <span>
                      {alert.status} via {alert.channel}
                    </span>
                    <time>{formatDate(alert.created_at)}</time>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
