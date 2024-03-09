import { Attachment, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../../shared/discord-js-types";
import { IMAGE_TOUCH_UP_SIZE_LIMIT } from '../../shared/constants';
import { OpenAi } from '../..';
import * as fs from 'fs'; 
import { InvalidFileSizeError, InvalidFileTypeError } from '../../shared/errors';
import chatCompletionService from '../../openAIClient/chatCompletion/chatCompletion.service';
import { createTempFile, deleteTempFilesByName, getRemoteFileBufferData } from '../../shared/utils';

const IMAGE_TYPE = 'image/png';

function validateImage(imageAttachment: Attachment) {
    if (imageAttachment.contentType !== IMAGE_TYPE) {
        throw new InvalidFileTypeError({
            error: `The image provided must be of type '${IMAGE_TYPE}'`,
            metaData: imageAttachment,
        });
    }

    if (imageAttachment.size > IMAGE_TOUCH_UP_SIZE_LIMIT) {
        throw new InvalidFileSizeError({
            error: `The Image provided is too large. Images should be no more than 4MB`,
            metaData: imageAttachment,
        });
    }
}

const aiImageVariotionCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('image_variation')
        .setDescription('Upload an image to touch up')
        .addAttachmentOption(image =>
            image.setName('image')
            .setRequired(true)
            .setDescription(`Provide a square 4MB .png image file to create variations`),
            )
        .addIntegerOption(intOtion => 
            intOtion.setName('image_count')
            .setDescription('The amount of images to generate')
            .addChoices(
                {name: '1', value: 1},
                { name: '2', value: 2 },
                { name: '3', value: 3},
                { name: '4', value: 4})), 
    async execute(interaction: ChatInputCommandInteraction) {
        const username = interaction.user.username;
        await interaction.reply(`Hi ${username}, I'm currently processing your image variation request :art:...`);

        let imageCount = interaction.options.getInteger('image_count', false) as number;
        imageCount = imageCount ? imageCount : 1;
        const imageAttachment = interaction.options.getAttachment('image', true);
        const tempImageName = `${interaction.id}-${imageAttachment.name}`;
        try {
            validateImage(imageAttachment);
            const imageBufferData = await getRemoteFileBufferData(imageAttachment.url);
            const tempImagePath = createTempFile(imageBufferData, tempImageName);
    
            await OpenAi.images.createVariation({
                image: fs.createReadStream(tempImagePath) as any,
                n: imageCount,
            }).then(async completion => {
                const embeds = chatCompletionService.generateImageEmbeds(completion, username);
                deleteTempFilesByName([tempImageName]);
                await interaction.editReply({
                    content: `Here are your image variations ${username} :blush:`,
                    embeds: embeds,
                });
            });


        }
        catch (err) {
            deleteTempFilesByName([tempImageName]);
            console.error(err);
            await interaction.editReply(`Sorry there was an issue creating an image variation :disappointed:`);
        }

    }
};

export = aiImageVariotionCommand;