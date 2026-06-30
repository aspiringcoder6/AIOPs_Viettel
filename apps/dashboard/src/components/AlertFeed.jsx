import { Bell } from "lucide-react";
import { formatDate, severityClass } from "../utils/dashboard";

export function AlertFeed({ alerts }) {
  return (
    <section className="panel alert-panel">
      <div className="panel-heading">
        <h2>Recent Alerts</h2>
        <Bell size={17} />
      </div>
      <div className="panel-body alert-feed">
        {alerts.length === 0 ? (
          <div className="empty">No alerts found.</div>
        ) : (
          alerts.slice(0, 10).map((alert) => (
            <div className="alert-row" key={alert.id}>
              <span className={severityClass(alert.severity)}>{alert.severity}</span>
              <div>
                <strong>
                  {alert.event_type} on {alert.service_name}
                </strong>
                <p>{alert.message.split("\n").slice(3).join(" ")}</p>
                <time>{formatDate(alert.created_at)}</time>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
