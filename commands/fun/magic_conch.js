const { SlashCommandBuilder } = require('discord.js');
const { Configuration, OpenAIApi } = require('openai');

// creating config object to authenticate openai requests
const configuration = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('magic_conch')
		.setDescription('Ask the all knowing magic conch shell')
		.addStringOption(option =>
			option.setName('question')
				.setDescription('What is your question?')
				.setRequired(true)),
	async execute(interaction) {
		const question = await interaction.options.getString('question', true).toLowerCase();

        try {
            const completion = await openai.createCompletion({
                model: "text-davinci-003",
                prompt: question,
                max_tokens:4000
                });
    
            const chatgptResponse = completion.data.choices[0].text;
            await interaction.reply({
                content:
                `The question asked was - ${question}\n
                My response is...\n
                ${chatgptResponse}`,
                ephemeral: false
            });
        } catch (error) {
            console.error(error);
            await interaction.reply(
                {
                    content: `There was an error handling your question!`,
                    ephemeral: true,
                }
            )
        }
	},
};