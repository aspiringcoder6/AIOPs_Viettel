import { Activity, AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";

const iconMap = {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
};

export function StatCard({ icon, label, value }) {
  const Icon = iconMap[icon] || Activity;

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
