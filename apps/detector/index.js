import {detectCpuSpike, detectLatencySpike, detectServiceDown} from "./rules.js"
import {pool} from './db.js';
import axios from 'axios';

async function verifyConnections() {
  try {
    // Check database
    await pool.query('SELECT NOW()');
    console.log('[DETECTOR] ✓ Database connected');
  } catch (err) {
    console.error('[DETECTOR] ✗ Database connection failed:', err.message);
    throw err;
  }

  try {
    // Check Prometheus
    const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://localhost:9090';
    await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
      params: { query: 'up' }
    });
    console.log('[DETECTOR] ✓ Prometheus connected');
  } catch (err) {
    console.error('[DETECTOR] ✗ Prometheus connection failed:', err.message);
    throw err;
  }
}

async function run() {
  console.log('[DETECTOR] Scanning for anomalies...');

  try {
    await detectCpuSpike();
    await detectLatencySpike();
    await detectServiceDown();
    console.log('[DETECTOR] Scan complete');
  } catch(err) {
    console.error('[DETECTOR] Error during anomaly detection:', err.message);
    console.error(err);
  }
}

// Initialize and start detector
(async () => {
  try {
    await verifyConnections();
    console.log('[DETECTOR] Starting anomaly detection...');
    await run();
    setInterval(run, 30000);
  } catch (err) {
    console.error('[DETECTOR] Failed to start:', err.message);
    process.exit(1);
  }
})();