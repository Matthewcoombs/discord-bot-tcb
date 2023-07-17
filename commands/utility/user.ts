import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../../shared/discord-js-types";
import { GuildMember } from "discord.js";

const userInfoCommand: Command = {
	data: new SlashCommandBuilder()
		.setName('user')
		.setDescription('Provides information about the user.'),
	async execute(interaction: ChatInputCommandInteraction) {
		const guildMember = interaction?.member as GuildMember;
		// interaction.user is the object representing the User who ran the command
		// interaction.member is the GuildMember object, which represents the user in the specific guild
		await interaction.reply(`This command was run by ${interaction.user.username}, who joined on ${guildMember.joinedAt}.`);
	},
};

export = userInfoCommand;