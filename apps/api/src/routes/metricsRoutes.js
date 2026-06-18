import { Router } from "express";
import {register} from "../services/metrics.js"
const router=Router();
router.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);

  res.end(await register.metrics());
});
export default router;