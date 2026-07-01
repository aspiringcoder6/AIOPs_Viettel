import {Router} from 'express';
import {
  getCPUSpikeRequest,
  getErrorRequest,
  getIncidentScenarios,
  getMemorySpike,
  getSlowRequest,
  runIncidentScenario,
} from '../controllers/incidentController.js';

const router=Router();
router.get('/scenarios',getIncidentScenarios);
router.get('/scenario/:scenario',runIncidentScenario);
router.post('/scenario/:scenario',runIncidentScenario);
router.get('/cpu-spike',getCPUSpikeRequest);
router.get('/error-spike',getErrorRequest);
router.get('/memory-spike',getMemorySpike);
router.get('/latency-spike',getSlowRequest);
export default router;
