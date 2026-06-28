import { Pool } from "pg";

export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5433,
  user: process.env.DB_USER || "admin",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "aiops",
});
