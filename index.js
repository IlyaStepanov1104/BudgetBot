// index.js

import dotenv from 'dotenv';
import { Bot } from './src/Bot.js';

dotenv.config();

export const DATA_FILE = process.env.DATA_FILE;


if (process.env.TELEGRAM_BOT_TOKEN) {
    console.log("Starting Telegram Bot");
    const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
    bot.start();
} else {
    throw new Error('ERROR: Telegram Api Bot token can not be null!');
}
