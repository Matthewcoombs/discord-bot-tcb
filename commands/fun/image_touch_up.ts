import * as fs from 'fs'; 
import axios from 'axios';
import { ChatInputCommandInteraction, Collection, Message, SlashCommandBuilder } from "discord.js";
import { Command } from "../../shared/discord-js-types";


// async function validateUploadedImage(response: Collection<string, Message>) {
    
//     response.forEach(async data => {
//         const { attachments } = data;

//         if (attachments.size > 1) {
//             throw Error('Please attach only one image.');
//         }

//         if (attachments.contentType !== 'image/jpeg') {
//             throw Error('Only jpeg images are supported at this time');
//         }
//         const res = await axios.get(attachment.url)
//         console.log(res.data);
//     })


// }

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
        const imageCount = interaction.options.getInteger('image_count', false);


        const collectorFilter = (response: Message) => {
            return response.author.username === username && !response.author.bot; 
        };

        await interaction.reply('Slash Command Recieved TESTING')
            .then(() => {
                interaction?.channel?.awaitMessages({ filter: collectorFilter, max: 1, time: 30000, errors: ['time'] })
			.then(async collected => {
                // await validateUploadedImage(collected);
				interaction.followUp(`${username} RESPONDED TESTNG`);
			})
			.catch(_ => {
				interaction.followUp('Something bad happened lol');
			});
            })


    }
}

export = aiImageVariotionCommand;