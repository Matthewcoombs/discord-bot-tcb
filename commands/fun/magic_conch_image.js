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

        try {
            const completion = await openai.createImage({
                prompt: description,
                });

            const imageUrl = completion.data.data[0].url;

            const embed = new EmbedBuilder()
            .setURL(imageUrl)
            .setThumbnail(imageUrl)
            await interaction.editReply({ 
                content: `Here is your picture ${username} :blush:!`,
                embeds: [
                embed]});

        } catch (error) {
            console.error(error);
            await interaction.reply(
                {
                    content: `There was an error generating your image!`,
                    ephemeral: true,
                }
            )
        }
	},
};