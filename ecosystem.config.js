module.exports = {
  apps: [
    {
      name: 'tiktok-mod',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
