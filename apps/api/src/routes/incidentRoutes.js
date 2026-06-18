import {Router} from 'express';
import { getCPUSpikeRequest, getErrorRequest,getMemorySpike,getSlowRequest } from '../controllers/incidentController.js';

const router=Router();
router.get('/cpu-spike',getCPUSpikeRequest);
router.get('/error-spike',getErrorRequest);
router.get('/memory-spike',getMemorySpike);
router.get('/latency-spike',getSlowRequest);
export default router;