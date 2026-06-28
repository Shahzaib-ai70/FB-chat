module.exports = {
  apps: [
    {
      name: "live-chat",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
