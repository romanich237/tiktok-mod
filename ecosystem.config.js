module.exports = {
  apps: [
    {
      name: 'tiktok-mod-mysql',
      script: 'scripts/mysql-local.sh',
      interpreter: 'bash',
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      error_file: 'logs/pm2-mysql-error.log',
      out_file: 'logs/pm2-mysql-out.log',
    },
    {
      name: 'tiktok-mod',
      script: 'src/index.js',
      interpreter: 'xvfb-run',
      interpreter_args: '-a node',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      restart_delay: 5000,
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
