module.exports = {
    apps: [
        {
            name: "menma-bot",
            script: "./index.js",
            watch: false,
            env: {
                NODE_ENV: "development",
            },
            env_production: {
                NODE_ENV: "production",
            },
            max_memory_restart: "500M",
            error_file: "./logs/err.log",
            out_file: "./logs/out.log",
            log_date_format: "YYYY-MM-DD HH:mm:ss"
        }
    ]
};
