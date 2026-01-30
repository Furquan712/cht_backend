module.exports = {
  apps: [{
    name: 'convertss-backend',
    script: './index.js',
    instances: 2,
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    // Restart delay
    restart_delay: 4000,
    // Listen for 'ready' event
    wait_ready: true,
    // Exponential backoff restart delay
    exp_backoff_restart_delay: 100,
    // Graceful shutdown
    kill_timeout: 5000,
    // Advanced features
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    // Environment variables from .env file
    dotenv: true
  }]
};
