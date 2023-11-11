import axios from 'axios';
import { Attachment, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../../shared/discord-js-types";
import { IMAGE_TOUCH_UP_SIZE_LIMIT } from '../../shared/constants';
import { OpenAi } from '../..';
import * as fs from 'fs'; 
import { InteractionError, InvalidFileError, InvalidFileSizeError, InvalidFileTypeError } from '../../shared/errors';
import chatCompletionService from '../../openAIClient/chatCompletion/chatCompletion.service';

const IMAGE_TYPE = 'image/png';
const TEMP_FOLDER_PATH = `./temp`;

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

async function getImageBufferData(imageAttachment: Attachment) {
    try {
        const { data } = await axios.get(imageAttachment.url, {
            responseType: 'arraybuffer',
        });
        return data;
    } catch (error) {
        throw new InteractionError({
            error: `There was an error retrieving the image data`,
            metaData: error,
        });
    }
}

function createTempImageFile(imageBufferData: string, fileName: string) {
    const tempImagePath = `${TEMP_FOLDER_PATH}/${fileName}`;
    try {
        fs.writeFileSync(tempImagePath, imageBufferData);
    } catch (err) {
        throw new InvalidFileError({
            error: `There was an error creating a temp image file`,
            metaData: err,
        });
    }

    return tempImagePath;
}

function deleteAllTempImages() {
    try {
        const tempImageFiles = fs.readdirSync(TEMP_FOLDER_PATH);
        for (const imageFile of tempImageFiles) {
            fs.unlinkSync(`${TEMP_FOLDER_PATH}/${imageFile}`);
        }
    } catch (err) {
        throw new InteractionError({
            error: `Error deleting temp image`,
            metaData: err,
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
            const imageBufferData = await getImageBufferData(imageAttachment);
            const tempImagePath = createTempImageFile(imageBufferData, tempImageName);
    
            await OpenAi.images.createVariation({
                image: fs.createReadStream(tempImagePath) as any,
                n: imageCount,
            }).then(async completion => {
                const embeds = chatCompletionService.generateImageEmbeds(completion, username);
                deleteAllTempImages();
                await interaction.editReply({
                    content: `Here are your image variations ${username} :blush:`,
                    embeds: embeds,
                });
            });


        }
        catch (err) {
            deleteAllTempImages();
            console.error(err);
            await interaction.editReply(`Sorry there was an issue creating an image variation :disappointed:`);
        }

    }
};

export = aiImageVariotionCommand;