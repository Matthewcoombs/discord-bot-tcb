import * as fs from 'fs'; 
import * as path from 'path';
import axios, { AxiosError } from 'axios';
import { Attachment, BaseGuild, ChatInputCommandInteraction, Collection, Message, SlashCommandBuilder } from "discord.js";
import { Command } from "../../shared/discord-js-types";
import { IMAGE_TOUCH_UP_SIZE_LIMIT } from '../../shared/constants';
import { OpenAi } from '../..';


async function validateUploadedImage(response: Collection<string, Message>) {
    const messageKey = response.firstKey() as string;
    const message = response.get(messageKey);
    const attachments = message?.attachments as Collection<string, Attachment>;

    if (attachments.size > 1) {
        throw Error('Please attach only one image.');
    }

    const attachmentKey = attachments.firstKey() as string;
    const attachment = attachments.get(attachmentKey);

    console.log(attachment?.contentType);
    
    if (attachment?.contentType !== 'image/png') {
        throw Error(`Sorry only jpeg images are supported at this time.`);
    }

    if (attachment.size > IMAGE_TOUCH_UP_SIZE_LIMIT) {
        throw Error(`Sorry the maximum image size allowed is 4mb at this time.`);
    }

    try {
        const res = await axios.get(attachment.url);
        const imageData = res.data;
        return imageData;
    } catch (_err) {
        throw Error(`Sorry there was an error retrieving the image for processing.`);
    }

}

const aiImageVariotionCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('image_touch_up')
        .setDescription('Upload an image to touch up')
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
        let imageCount = interaction.options.getInteger('image_count', false) as number;
        imageCount = imageCount ? imageCount : 1;

        const collectorFilter = (response: Message) => {
            return response.author.username === username && !response.author.bot; 
        };

        await interaction.reply('Slash Command Recieved TESTING')
            .then(() => {
                interaction?.channel?.awaitMessages({ filter: collectorFilter, max: 1, time: 30000, errors: ['time'] })
			.then(async collected => {
                const imageData = await validateUploadedImage(collected);
                // const tempFolderPath = path.resolve()
                // const tempImagePath = `${tempFolderPath}/${interaction.id}/imageTouchUp.jpeg`;
                // fs.writeFile(tempImagePath, imageData, "binary", (err) => {
                //     if (err) {
                //         throw Error(`Sorry there was an error processing your image.`);
                //     }
                // });

                const imageBuffer = new (Buffer as any).from(imageData);
                imageBuffer.name = `image.png`;
                console.log(imageBuffer);
                console.log(imageBuffer.length);
                await OpenAi.createImageVariation(
                    imageBuffer,
                    imageCount,
                ).then(async completion => {
                    const data = completion.data;
                    console.log(data);
                })


				interaction.followUp(`${username} RESPONDED TESTNG`);
			})
			.catch((err: AxiosError) => {
                console.error(err.response?.data);
				interaction.followUp('Something bad happened lol');
			});
            })


    }
}

export = aiImageVariotionCommand;