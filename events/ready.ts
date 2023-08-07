import { Client, Events } from "discord.js";
import { Command } from "../shared/discord-js-types";

const clientReadyEvent: Command = {
	name: Events.ClientReady,
	once: true,
	execute(client: Client) {
		console.log(`Ready! Logged in as ${client?.user?.tag}`);
	}
};

export = clientReadyEvent;
