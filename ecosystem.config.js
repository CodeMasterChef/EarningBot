module.exports = {
  apps: [
    {
      name: "poolx-bot",
      script: "dist/index.js",
      cwd: __dirname,
      restart_delay: 5000,
      max_restarts: 50,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
