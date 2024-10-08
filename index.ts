import { ChannelType, Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { configureOpenAi } from './openAIClient/init';
import * as fs from 'fs'; 
import * as path from 'path';
import { connectToPG } from "./database/init";
import { UserProfile } from "./database/user_profiles/userProfilesDao";
import { configureEmailTransporter } from "./emailClient/init";

// init env variables
require('dotenv').config();

// Init Postgres
export const sql = connectToPG();

// Init openAI
export const OpenAi = configureOpenAi();
export const EmailTransporter = configureEmailTransporter();


// Create a new client instance
declare module "discord.js" {
    export interface Client {
        commands: Collection<unknown, any>
		cooldowns: Collection<unknown, any>
		singleInstanceCommands: Collection<string, { 
			channelType: ChannelType | undefined, 
			channelId: string | undefined, 
			channelName: string | null,
			name: string, 
			user:string, 
			userId: string}>
		singleInstanceMessageCollector: Collection<string, { 
			userId: string, 
			selectedProfile: UserProfile, 
			channelId: string }>
    }
}

const client = new Client({ intents: [
	GatewayIntentBits.Guilds, 
	GatewayIntentBits.DirectMessages, 
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent, 
	GatewayIntentBits.GuildPresences,
	GatewayIntentBits.GuildMembers,
], partials: [Partials.Channel] });

client.commands = new Collection();
client.cooldowns = new Collection();
client.singleInstanceCommands = new Collection();
client.singleInstanceMessageCollector = new Collection();
const TOKEN = process.env.DISCORD_TOKEN;

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter((file: string) => file.endsWith('.js'));
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
const eventFiles = fs.readdirSync(eventsPath).filter((file: string) => file.endsWith('.js'));

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