import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandStringOption } from "discord.js";
import { Command } from "../../shared/discord-js-types";
import { OpenAi } from "../..";
import chatCompletionService from "../../openAIClient/chatCompletion/chatCompletion.service";
import { TEMP_FOLDER_PATH } from "../../shared/constants";
import * as fs from 'fs';
import { imageModelEnums } from "../../config";
import { ImageGenerateParams } from "openai/resources";
import { generateInteractionTag } from "../../shared/utils";

const aiImageGenerateCommand: Command = {
	data: new SlashCommandBuilder()
		.setName('generate_image')
		.setDescription('Generate images')
		.addStringOption((strOption: SlashCommandStringOption) =>
			strOption.setName('description')
				.setDescription('Describe the image you want generated')
				.setRequired(true)
        )
        .addStringOption((strOption: SlashCommandStringOption) =>
        strOption.setName('model')
            .setDescription('The AI model to generate the image')
            .setRequired(true)
            .addChoices(
                {name: imageModelEnums.DALLE2, value: imageModelEnums.DALLE2},
                {name: imageModelEnums.DALLE3, value: imageModelEnums.DALLE3},
            )
        )
        .addStringOption((strOption: SlashCommandStringOption) =>
        strOption.setName('quality')
            .setDescription(`The quality of image to generate (hd is only supported with ${imageModelEnums.DALLE3})`)
            .addChoices(
                {name: 'standard', value: 'standard'},
                {name: 'high definition', value: 'hd'},
            )
        )
        .addStringOption((strOption: SlashCommandStringOption) =>
        strOption.setName('style')
            .setDescription(`The style of image to generate (style is only supported with ${imageModelEnums.DALLE3})`)
            .addChoices(
                {name: 'vivid', value: 'vivid'},
                {name: 'natural', value: 'natural'},
            )
        )
        .addIntegerOption((intOption) =>
            intOption.setName('image_count')
                .setDescription(`The amount of images to generate (multiple images is only supported with ${imageModelEnums.DALLE2})`)
                .addChoices(
                    {name: '1', value: 1},
                    { name: '2', value: 2 },
                    { name: '3', value: 3},
                    { name: '4', value: 4}
                )
        ),
	async execute(interaction: ChatInputCommandInteraction) {
        const interactionTag = generateInteractionTag();
        const username = interaction.user.username;
		const description = await interaction.options.getString('description', true).toLowerCase();
        const model =  await interaction.options.getString('model');
        let quality = await interaction.options.getString('quality') as "standard" | "hd";
        quality = quality ? quality : 'standard';
        let  style = await interaction.options.getString('style') as "vivid" | "natural";
        style = style ? style : 'vivid';
        let imageCount = await interaction.options.getInteger('image_count', false);
        imageCount = imageCount ? imageCount : 1;


        // checking the model value provided to determine the payload sent to the openAI API
        let openAIBody: ImageGenerateParams = {
            model,
            prompt: description,
        };

        switch (model) {
            case imageModelEnums.DALLE2:
                openAIBody = { 
                    ...openAIBody,
                    n: imageCount,
                };
                break;
            case imageModelEnums.DALLE3:
                openAIBody = {
                    ...openAIBody,
                    n: 1,
                    quality,
                    style,
                };
                break;
            }

        await interaction.reply(`${username} asked for an image, so I'm working on it :art:...`);
        await OpenAi.images.generate(openAIBody)
            .then(async completion => {
                const imageUrls = completion.data.map(image => image.url) as string[];
                await chatCompletionService.downloadAndConvertImagesToJpeg(imageUrls, username, interactionTag);
                let imageFiles = fs.readdirSync(TEMP_FOLDER_PATH);
                imageFiles = imageFiles
                    .filter(fileName => fileName.includes(username) && fileName.includes(interactionTag.toString()))
                    .map(fileName => `${TEMP_FOLDER_PATH}/${fileName}`);

                await interaction.editReply({ 
                    content: `Here is your picture ${username} :blush:!`,
                    files: imageFiles});
            })
            .catch(async err => {
                console.error(err);
                await interaction.editReply(`Sorry ${username}, I ran into an error attempting to create your image! Please check to ensure your question is not offensive and doesn't relate to any known people :sweat_smile:.
                `);
                await interaction.followUp({
                    content: `What you told me to create: ${description}`,
                    ephemeral: true,
                });
            });

	},
};

export = aiImageGenerateCommand;