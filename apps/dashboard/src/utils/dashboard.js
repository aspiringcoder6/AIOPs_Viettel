export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3100/api";

export async function requestJson(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);

  if (!response.ok) {
    throw new Error(`Request failed ${response.status}`);
  }

  return response.json();
}

export function formatDate(value) {
  if (!value) {
    return "n/a";
  }

  return new Date(value).toLocaleString();
}

export function severityClass(severity) {
  return `severity severity-${String(severity || "P3").toLowerCase()}`;
}

export function statusClass(status) {
  return `status status-${String(status || "OPEN").toLowerCase()}`;
}
