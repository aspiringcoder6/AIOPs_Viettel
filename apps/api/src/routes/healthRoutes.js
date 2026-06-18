import {Router} from 'express';
import { getHealth,testDbHealth,testRedisHealth } from '../controllers/healthController.js';
const router = Router();
router.get('/health', getHealth);
router.get('/test_db',testDbHealth);
router.get('/test_redis',testRedisHealth);
export default router;