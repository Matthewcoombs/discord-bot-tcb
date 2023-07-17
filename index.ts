import { Client, Collection, GatewayIntentBits } from "discord.js";
import * as fs from 'fs';
import { Configuration, OpenAIApi } from "openai";
import * as path from 'path';

// init env variables
require('dotenv').config();

// creating config object to authenticate openai requests
const configuration = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
});

export const OpenAi = new OpenAIApi(configuration);


// Create a new client instance
declare module "discord.js" {
    export interface Client {
        commands: Collection<unknown, any>
		cooldowns: Collection<unknown, any>
    }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();
client.cooldowns = new Collection();
const TOKEN = process.env.DISCORD_TOKEN;

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter((file: string) => file.endsWith('.ts'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((file: string) => file.endsWith('.ts'));

for (const file of eventFiles) {
	const filePath = path .join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

// Log in to Discord with your client's token
client.login(TOKEN);