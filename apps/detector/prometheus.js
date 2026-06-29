import axios from "axios";

const PROMETHEUS_URL =
  process.env.PROMETHEUS_URL ||
  "http://localhost:9090";

export async function query(promql) {

  const response = await axios.get(
    `${PROMETHEUS_URL}/api/v1/query`,
    {
      params: {
        query: promql
      }
    }
  );

  return response.data.data.result;
}