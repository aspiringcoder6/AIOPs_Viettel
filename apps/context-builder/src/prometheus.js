import axios from "axios";

const PROMETHEUS_URL =
  process.env.PROMETHEUS_URL ||
  "http://localhost:9090";

export async function queryMetric(name, promql) {
  const response = await axios.get(
    `${PROMETHEUS_URL}/api/v1/query`,
    {
      params: {
        query: promql,
      },
    }
  );

  return {
    name,
    query: promql,
    results: response.data.data.result,
  };
}
