import redisClient from '../redis/client.js';
import {pool} from '../db/database.js';

export const getHealth = async (req, res) => {
    try {
        res.status(200).json({ status: 'ok',timeStamp: new Date() });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};
//DATABASE_CONNECTION_FAILURE
export const testDbHealth=async (req,res)=>{
    try {
    const result = await pool.query(
      "SELECT NOW()"
    );

    res.json({
      database: "reachable",
      time: result.rows[0].now,
    });
  } catch (err) {
    console.error(
      "[SIMULATION] Database unavailable",
      err.message
    );

    res.status(500).json({
      error: "Database unavailable",
    });
  }
}
//REDIS_CONNECTION_FAILURE
export const testRedisHealth = async(req,res)=>{
    try {
    await redisClient.set(
      "incident-test",
      Date.now().toString()
    );

    const value =
      await redisClient.get("incident-test");

    res.json({
      redis: "reachable",
      value,
    });
  } catch (err) {
    console.error(
      "[SIMULATION] Redis unavailable",
      err.message
    );

    res.status(500).json({
      error: "Redis unavailable",
    });
  }
}