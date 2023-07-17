import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../../shared/discord-js-types";

const pingCommand: Command = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with Pong!'),
	async execute(interaction : CommandInteraction) {
		await interaction.reply('Pong!');
	}
}

export = pingCommand;