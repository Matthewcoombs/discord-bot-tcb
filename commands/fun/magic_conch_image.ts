import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, SlashCommandStringOption } from "discord.js";
import { Command } from "../../shared/discord-js-types";
import { OpenAi } from "../..";

const aiImageGenerateCommand: Command = {
	data: new SlashCommandBuilder()
		.setName('magic_conch_image')
		.setDescription('Ask the all knowing magic conch shell to generate an image')
		.addStringOption((option: SlashCommandStringOption) =>
			option.setName('description')
				.setDescription('Describe the image you want generated')
				.setRequired(true)),
	async execute(interaction: ChatInputCommandInteraction) {
        const username = interaction.user.username;
		const description = await interaction.options.getString('description', true).toLowerCase();
        await interaction.reply(`${username} asked for an image, so I'm working on it :art:...`);
        await OpenAi.createImage({
            prompt: description,
            n: 4,
            })
            .then(async completion => {
                // const imageUrl = completion.data.data[0].url as string;
                const imageUrls = completion.data.data.map( genImage => { return genImage.url as string });
                const embeds = imageUrls.map(imageUrl => {
                    return  new EmbedBuilder()
                    .setTitle(`${username}'s Image of ${description}`)
                    // .setURL(imageUrl)
                    .setImage(imageUrl)
                });

                embeds[0].setTitle(`${username}'s Image of ${description}`);
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