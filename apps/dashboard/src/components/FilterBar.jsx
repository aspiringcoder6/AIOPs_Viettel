export function FilterBar({ filters, services, onChange }) {
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
