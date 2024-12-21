import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { initOpenAI } from './openAIClient/init';
import * as fs from 'fs';
import * as path from 'path';
import { connectToPG } from './database/init';
import { ChatInstance, SingleInstanceCommand } from './shared/discord-js-types';
import { initAnthropicAI } from './anthropicClient/init';

// init env variables
require('dotenv').config();

// Init Postgres
export const pg = connectToPG();
(async () => {
  try {
    await pg.connect();
    console.log('Connected to postgres!');
  } catch (err) {
    console.error(`Error connecting to postgres:`, err);
  }
})();

// Init openAI
export const OpenAi = initOpenAI();
// Init anthropic
export const Anthropic = initAnthropicAI();

declare module 'discord.js' {
  export interface Client {
    commands: Collection<unknown, any>;
    cooldowns: Collection<unknown, any>;
    singleInstanceCommands: Collection<string, SingleInstanceCommand>;
    chatInstanceCollector: Collection<string, ChatInstance>;
  }
}

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();
client.cooldowns = new Collection();
client.singleInstanceCommands = new Collection();
client.chatInstanceCollector = new Collection();
const TOKEN = process.env.DISCORD_TOKEN;

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file: string) => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
      );
    }
  }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file: string) => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Log in to Discord with your client's token
client.login(TOKEN);
