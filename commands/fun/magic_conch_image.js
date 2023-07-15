const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Configuration, OpenAIApi } = require('openai');

// creating config object to authenticate openai requests
const configuration = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('magic_conch_image')
		.setDescription('Ask the all knowing magic conch shell to generate an image')
		.addStringOption(option =>
			option.setName('description')
				.setDescription('Describe the image you want generated')
				.setRequired(true)),
	async execute(interaction) {
        const username = interaction.user.username;
		const description = await interaction.options.getString('description', true).toLowerCase();
        await interaction.reply(`${username} asked for an image, so I'm working on it :art:...`);
        await openai.createImage({
            prompt: description,
            })
            .then(async completion => {
                const imageUrl = completion.data.data[0].url;
                const embed = new EmbedBuilder()
                .setTitle(`${username}'s Image of ${description}`)
                .setURL(imageUrl)
                .setImage(imageUrl)
                await interaction.editReply({ 
                    content: `Here is your picture ${username} :blush:!`,
                    embeds: [
                    embed]});
            })
            .catch(error => {
                interaction.editReply(`Sorry ${username}, I ran into an error attempting to create your image! Please check to ensure your question is not offensive and doesn't relate to any known people :sweat_smile:.
                `);
                interaction.followUp({
                    content: `What you told me to create: ${description}`,
                    ephemeral: true,
                })
            });

	},
};