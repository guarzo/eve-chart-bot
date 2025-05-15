module.exports = {
  apps: [
    {
      name: "discord-bot",
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "logs/bot-error.log",
      out_file: "logs/bot-out.log",
      time: true,
      autorestart: true,
      watch: false,
    },
  ],
};
