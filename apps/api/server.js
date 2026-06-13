import app from './app.js';
import {pool} from './src/db/database.js';
import redisClient from './src/redis/client.js';
const PORT = process.env.PORT || 3000;
async function waitForDatabase() {
    let retryCount = 0;
    const maxRetries = 10;
    while (true) {
        try {
            const result = await pool.query('SELECT NOW()');
            console.log('Database connected:', result.rows[0]);
            return;
        } catch (err) {
            retryCount++;
            if (retryCount >= maxRetries) {
                console.error('Failed to connect to PostgreSQL');
                process.exit(1);
            }
            console.log('Waiting for PostgreSQL...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}
async function waitForRedis() {
    let retryCount = 0;
    const maxRetries = 10;
    while (true) {
        try {
            await redisClient.connect();
            console.log('Redis connected');
            return;
        }
        catch (err) {
            retryCount++;
            if (retryCount >= maxRetries) {
                console.error('Failed to connect to Redis');
                process.exit(1);
            }
            console.log('Waiting for Redis...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}
async function startServer(){
    await waitForDatabase();
    await waitForRedis();

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

}
startServer();