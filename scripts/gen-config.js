#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envVars = {
    D1_DATABASE_ID: process.env.D1_DATABASE_ID,
    ENABLE_AI_EXTRACT: process.env.ENABLE_AI_EXTRACT,
    EXTRACT_MODEL: process.env.EXTRACT_MODEL,
    EXTRACT_PROVIDER: process.env.EXTRACT_PROVIDER,
    CLASSIFY_PROVIDER: process.env.CLASSIFY_PROVIDER,
    CLASSIFY_MODEL: process.env.CLASSIFY_MODEL,
    CLASSIFY_CRON: process.env.CLASSIFY_CRON,
    CLASSIFY_BATCH_SIZE: process.env.CLASSIFY_BATCH_SIZE,
    ENABLE_CLASSIFY: process.env.ENABLE_CLASSIFY,
    CLASSIFY_MIN_CONFIDENCE: process.env.CLASSIFY_MIN_CONFIDENCE,
    JWT_MIN_TTL: process.env.JWT_MIN_TTL,
    JWT_MAX_TTL: process.env.JWT_MAX_TTL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    USERNAME: process.env.USERNAME,
    PASSWORD: process.env.PASSWORD,
    ENABLE_AUTO_DEL: process.env.ENABLE_AUTO_DEL,
    AUTO_DEL_TYPE: process.env.AUTO_DEL_TYPE,
    AUTO_DEL_TIME: process.env.AUTO_DEL_TIME,
    AUTO_DEL_CRON: process.env.AUTO_DEL_CRON,
    FORWARD_MAP: process.env.FORWARD_MAP,
    WEBHOOK_URL: process.env.WEBHOOK_URL,
    WEBHOOK_TYPE: process.env.WEBHOOK_TYPE,
    WEBHOOK_TEMPLATE: process.env.WEBHOOK_TEMPLATE,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    TELEGRAM_TEMPLATE: process.env.TELEGRAM_TEMPLATE,
    TELEGRAM_TYPE: process.env.TELEGRAM_TYPE,
};

const configPath = path.join(__dirname, '..', 'wrangler.jsonc');
const envLocalPath = path.join(__dirname, '..', '.env.local');

const configContent = fs.readFileSync(configPath, 'utf-8');
const config = JSON.parse(configContent);

if (config.vars) {
    ['ENABLE_AI_EXTRACT', 'EXTRACT_MODEL', 'EXTRACT_PROVIDER', 'CLASSIFY_PROVIDER', 'CLASSIFY_MODEL', 'CLASSIFY_CRON', 'CLASSIFY_BATCH_SIZE', 'ENABLE_CLASSIFY', 'CLASSIFY_MIN_CONFIDENCE', 'JWT_MIN_TTL', 'JWT_MAX_TTL', 'ENABLE_AUTO_DEL', 'AUTO_DEL_TYPE', 'AUTO_DEL_TIME', 'FORWARD_MAP', 'WEBHOOK_URL', 'WEBHOOK_TYPE', 'WEBHOOK_TEMPLATE', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'TELEGRAM_TEMPLATE', 'TELEGRAM_TYPE']
        .forEach(key => {
            if (envVars[key]) config.vars[key] = envVars[key];
        });
}

if (config.d1_databases?.[0]?.database_id && envVars.D1_DATABASE_ID) {
    config.d1_databases[0].database_id = envVars.D1_DATABASE_ID;
}

if (config.triggers?.crons?.[0] && envVars.AUTO_DEL_CRON) {
    config.triggers.crons[0] = envVars.AUTO_DEL_CRON;
}

// 分类队列消费 cron：作为第二条定时触发器
if (envVars.CLASSIFY_CRON) {
    config.triggers.crons[1] = envVars.CLASSIFY_CRON;
}

fs.writeFileSync(configPath, JSON.stringify(config, null, '\t'), 'utf-8');
console.log(`✓ 更新 wrangler.jsonc`);

const envLocalVars = {
    OPENAI_API_KEY: envVars.OPENAI_API_KEY,
    OPENAI_BASE_URL: envVars.OPENAI_BASE_URL,
    USERNAME: envVars.USERNAME,
    PASSWORD: envVars.PASSWORD,
};

const envFileContent = Object.entries(envLocalVars)
    .filter(([_, value]) => value)
    .map(([key, value]) => `${key}="${value}"`)
    .join('\n') + '\n';

if (envFileContent.trim()) {
    fs.writeFileSync(envLocalPath, envFileContent, 'utf-8');
    console.log(`✓ 生成 .env.local`);
}
