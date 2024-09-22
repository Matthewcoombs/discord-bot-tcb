import { ChatInputCommandInteraction, CollectedInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../../shared/discord-js-types";
import { TEMP_FOLDER_PATH } from '../../shared/constants';
import { OpenAi } from '../..';
import * as fs from 'fs'; 
import chatCompletionService from '../../openAIClient/chatCompletion/chatCompletion.service';
import { createTempFile, deleteTempFilesByName, deleteTempFilesByTag, generateInteractionTag, getRemoteFileBufferData, validateImage } from '../../shared/utils';
import imagesService from "../../openAIClient/images/images.service";
import { imageModelEnums } from "../../config";
import { InteractionTimeOutError } from "../../shared/errors";

const aiImageVariotionCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('image_variation')
        .setDescription('Upload a .png image to touch up')
        .addAttachmentOption(image =>
            image.setName('image_file')
            .setRequired(true)
            .setDescription(`Provide a square .png image file no larger then 4MB to create variations`),
            )
        .addIntegerOption(intOtion => 
            intOtion.setName('image_count')
            .setDescription('The amount of image varitions to generate')
            .addChoices(
                {name: '1', value: 1},
                { name: '2', value: 2 },
                { name: '3', value: 3},
                { name: '4', value: 4})), 
    async execute(interaction: ChatInputCommandInteraction) {
        const interactionTag = generateInteractionTag();
        const { username, id: userId } = interaction.user;

        let imageCount = interaction.options.getInteger('image_count', false) as number;
        imageCount = imageCount ? imageCount : 1;
        const imageAttachment = interaction.options.getAttachment('image_file', true);
        const tempImageName = `${interaction.id}-${imageAttachment.name}`;

        // prompting the user for their desired image size(s) based on the image model selected
        const actionRowComponent = imagesService.generateImageSizeSelection(imageModelEnums.DALLE2);
        const sizeResponse = await interaction.reply({
            content: `Select a size for your image(s)`,
            components: [actionRowComponent as any],
            ephemeral: true,
        });

        const collectorFilter = (message: CollectedInteraction) => { return message?.user?.id === userId;};
        const imageSizeSelected = await sizeResponse.awaitMessageComponent({
            filter: collectorFilter,
            time: 60000,
        }).catch(() => {
            sizeResponse.delete();
            throw new InteractionTimeOutError({
                error:  `:warning: Image variation cancelled. Image size selection timeout reached.`,
            });
        });

        const size = imageSizeSelected.customId;

        await interaction.editReply({
            content: `Hi ${username}, I'm currently processing your image variation request :art:...`,
            components: [],
        });

        try {
            validateImage(imageAttachment);
            const imageBufferData = await getRemoteFileBufferData(imageAttachment.url);
            const tempImagePath = createTempFile(imageBufferData, tempImageName);
    
            await OpenAi.images.createVariation({
                image: fs.createReadStream(tempImagePath) as any,
                n: imageCount,
                size: size as any,
            }).then(async completion => {
                const imageUrls = completion.data.map(image => image.url) as string[];
                await chatCompletionService.downloadAndConvertImagesToJpeg(imageUrls, username, interactionTag);
                let imageFiles = fs.readdirSync(TEMP_FOLDER_PATH);
                imageFiles = imageFiles
                    .filter(fileName => fileName.includes(username) && fileName.includes(interactionTag.toString()))
                    .map(fileName => `${TEMP_FOLDER_PATH}/${fileName}`);
                deleteTempFilesByName([tempImageName]);
                await interaction.editReply({
                    content: `Here are your image variations ${username} :blush:`,
                    files: imageFiles,
                });
                deleteTempFilesByTag(interactionTag);
            });
        }
        catch (err) {
            deleteTempFilesByName([tempImageName]);
            deleteTempFilesByTag(interactionTag);
            console.error(err);
            await interaction.editReply(`Sorry there was an issue creating an image variation :disappointed:`);
        }

    }
};

export = aiImageVariotionCommand;