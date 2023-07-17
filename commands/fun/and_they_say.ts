import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../../shared/discord-js-types";


const andTheySayCommand: Command = {
	cooldown: 3,
	data: new SlashCommandBuilder()
		.setName('and_they_say')
		.setDescription('Replies with Chivalry is Dead!'),
	async execute(interaction: ChatInputCommandInteraction) {
		await interaction.reply('Chivalry is dead!');
	},
};

export = andTheySayCommand;