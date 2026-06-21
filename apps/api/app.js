import express from 'express';
import healthRoutes from './src/routes/healthRoutes.js';
import incidentRoutes from './src/routes/incidentRoutes.js'
import redisClient from './src/redis/client.js';
import metricsRoutes from './src/routes/metricsRoutes.js'
import {httpRequestsTotal,requestDuration,errorCounter} from './src/services/metrics.js'
const app = express();
//Middleware to get metrics
const EXCLUDED_ROUTES = [
  "/api/metrics",
];

app.use((req, res, next) => {
  if (EXCLUDED_ROUTES.includes(req.path)) {
    return next();
  }
  const end = requestDuration.startTimer();
  res.on("finish", () => {
    end({
      method: req.method,
      route: req.path,
    });
    if (res.statusCode >= 500) {
      errorCounter.inc({
        method: req.method,
        route: req.path,
        status: res.statusCode,
      });
      }
    httpRequestsTotal.inc({
      method: req.method,
      route: req.path,
      status: res.statusCode,
    });
  });

  next();
});

//Endpoints
app.get('/redis-test', async (req, res) => {
    try {
        await redisClient.set('test-key', 'Hello Redis!');
        const value = await redisClient.get('test-key');
        res.json({message: 'Redis is working!', value});
    } catch (err) {
        console.error('Redis test failed:', err);
        res.status(500).json({message: 'Redis test failed', error: err.message});
    }
});
app.use('/api',metricsRoutes);
app.use('/api/health',healthRoutes);
app.use('/api/incident',incidentRoutes);
export default app;
