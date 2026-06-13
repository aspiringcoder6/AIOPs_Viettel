import express from 'express';
import healthRoutes from './src/routes/healthRoutes.js';
const app = express();
app.use('/api',healthRoutes);
export default app;