import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../../shared/discord-js-types";

const serverDetailsCommand: Command = {
	data: new SlashCommandBuilder()
		.setName('server_details')
		.setDescription('Provides information about the server.'),
	async execute(interaction: ChatInputCommandInteraction) {
		const guildName = interaction?.guild?.name;
		const serverMemberCount = interaction?.guild?.memberCount;
		// interaction.guild is the object representing the Guild in which the command was run
		await interaction.reply({ content: `This server is ${guildName} and has ${serverMemberCount} members.`, ephemeral: true});
	},
};

export = serverDetailsCommand;