#!/usr/bin/env node

/**
 * Health Check Script for Docker Container
 * Tests the LogAI application health endpoint
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/health',
  method: 'GET',
  timeout: 5000,
};

const req = http.request(options, res => {
  if (res.statusCode === 200) {
    console.log('✅ Health check passed');
    process.exit(0);
  } else {
    console.error(`❌ Health check failed with status: ${res.statusCode}`);
    process.exit(1);
  }
});

req.on('error', err => {
  console.error(`❌ Health check failed: ${err.message}`);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('❌ Health check timed out');
  req.destroy();
  process.exit(1);
});

req.end();
