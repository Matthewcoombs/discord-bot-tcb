const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('count_down')
		.setDescription('Start a count down!')
		.addIntegerOption(countStart =>
			countStart.setName('count')
			.setDescription('Count down timer starting value')
			.setRequired(true)),
	async execute(interaction) {
		let count = interaction.options.getInteger('count', true);
		await interaction.reply(`Beginning Countdown!`);
		const message = await interaction.fetchReply();

		let intervalId
		 intervalId = setInterval(async () => {
			await interaction.editReply(`${count}!`);
			count--
			if (count === -1) {
				await interaction.deleteReply(message);
				await interaction.followUp(`Go for it!`);
				clearInterval(intervalId);
			}
		},
		1000)
		}
};