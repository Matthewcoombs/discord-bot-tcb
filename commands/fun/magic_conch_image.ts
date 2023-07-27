import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, SlashCommandStringOption } from "discord.js";
import { Command } from "../../shared/discord-js-types";
import { OpenAi } from "../..";
import { ImagesResponse } from "openai";

function generateImageEmbeds(generatedImages: ImagesResponse, username: string, description: string) {
    const embeds = generatedImages.data.map(image => {
        const imageUrl = image?.url as string;
        return new EmbedBuilder()
            .setURL(imageUrl)
            .setImage(imageUrl);
    });

    embeds[0].setTitle(`${username}'s image(s) of ${description}`);

    return embeds;
}

const aiImageGenerateCommand: Command = {
	data: new SlashCommandBuilder()
		.setName('magic_conch_image')
		.setDescription('Ask the all knowing magic conch shell to generate an image')
		.addStringOption((strOption: SlashCommandStringOption) =>
			strOption.setName('description')
				.setDescription('Describe the image you want generated')
				.setRequired(true))
        .addIntegerOption((intOption) =>
            intOption.setName('image_count')
                .setDescription('The amount of images to generate')
                .addChoices(
                    {name: '1', value: 1},
                    { name: '2', value: 2 },
                    { name: '3', value: 3},
                    { name: '4', value: 4})),
	async execute(interaction: ChatInputCommandInteraction) {
        const username = interaction.user.username;
		const description = await interaction.options.getString('description', true).toLowerCase();
        const imageCount = await interaction.options.getInteger('image_count', false);
        await interaction.reply(`${username} asked for an image, so I'm working on it :art:...`);
        await OpenAi.createImage({
            prompt: description,
            n: imageCount,
            })
            .then(async completion => {
                const embeds = generateImageEmbeds(completion.data, username, description);
                await interaction.editReply({ 
                    content: `Here is your picture ${username} :blush:!`,
                    embeds: embeds});
            })
            .catch(async err => {
                console.error(err)
                await interaction.editReply(`Sorry ${username}, I ran into an error attempting to create your image! Please check to ensure your question is not offensive and doesn't relate to any known people :sweat_smile:.
                `);
                await interaction.followUp({
                    content: `What you told me to create: ${description}`,
                    ephemeral: true,
                })
            });

	},
};

export = aiImageGenerateCommand;