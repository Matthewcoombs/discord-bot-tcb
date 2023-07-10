const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	cooldown: 3,
	data: new SlashCommandBuilder()
		.setName('and_they_say')
		.setDescription('Replies with Chivalry is Dead!'),
	async execute(interaction) {
		await interaction.reply('Chivalry is dead!');
	},
};