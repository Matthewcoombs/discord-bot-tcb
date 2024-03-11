import { Client, Events } from "discord.js";
import { Command } from "../shared/discord-js-types";
import * as fs from 'fs';

const clientReadyEvent: Command = {
	name: Events.ClientReady,
	once: true,
	execute(client: Client) {
		const botDisplayName = client.user?.displayName as string;

		const packageJsonPath = './package.json';
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

		const regex = /\b\d+\.\d+\.\d+\b/;
        const match = botDisplayName.match(regex);
        const botDisplayVersion = match ? match[0] : null;

		if (botDisplayVersion && botDisplayVersion !== packageJson.version) {
			const updatedBotName = botDisplayName.replace(botDisplayVersion, packageJson.version);
			console.log(`Bot version update detected. Updating bot [name]: ${updatedBotName}`);
			// await client.user?.setUsername(updatedBotName);
		}
		console.log(`Ready! Logged in as ${client?.user?.tag}`);
	}
};

export = clientReadyEvent;
