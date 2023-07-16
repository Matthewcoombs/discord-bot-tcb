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
        const username = interaction.user.username;
        await interaction.reply(`${username} asked me a question, so I'm thinking :thinking:...`);
        
		const question = await interaction.options.getString('question', true).toLowerCase();

            await openai.createCompletion({
                model: "text-davinci-003",
                prompt: question,
                max_tokens: 4000
                }).then(async completion => {
                    const chatgptResponse = completion.data.choices[0].text;
                    await interaction.editReply(
                        `The question asked was - ${question}\n
                        My response is...
                        ${chatgptResponse}
                        hope that helps :blush:!
                        `);
                }).catch(async error => {
                    await interaction.editReply(`Sorry ${username}, I've run into an issue attempting to answer your question.`)
                });

	},
};