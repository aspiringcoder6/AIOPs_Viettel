import {Pool} from "pg"

export const pool = new Pool({
  host: "localhost",
  port: 5433,
  user: "admin",
  password: "password",
  database: "aiops"
});
