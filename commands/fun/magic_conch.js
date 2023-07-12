const { SlashCommandBuilder } = require('discord.js');
const { openai } = require('../..');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('magic_conch')
		.setDescription('Ask the all knowing magic conch shell')
		.addStringOption(option =>
			option.setName('question')
				.setDescription('What is your question?')
				.setRequired(true)),
	async execute(interaction) {
		const question = interaction.options.getString('question', true).toLowerCase();

        const completion = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: question,
            max_tokens:4000
            });
            
        const chatgptResponse = completion.data.choices[0].text;
        await interaction.reply(
            `The question asked was - ${question}\n
            My response is...\n
            ${chatgptResponse}`);
	},
};