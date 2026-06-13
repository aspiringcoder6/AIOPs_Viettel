import express from 'express';
import healthRoutes from './src/routes/healthRoutes.js';
import redisClient from './src/redis/client.js';
const app = express();
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
app.use('/api',healthRoutes);
export default app;