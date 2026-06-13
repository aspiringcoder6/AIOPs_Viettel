import {createClient} from 'redis';

const redisClient = createClient({
    socket:{
        host:process.env.REDIS_HOST || 'redis',
        port: process.env.REDIS_PORT || 6379
    }
});


redisClient.on('error', (err) => console.log('Redis Client Error', err));
export default redisClient;
