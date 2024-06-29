import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { imageModelEnums } from "../../config";


export default {
    generateImageSizeSelection (imageModel: imageModelEnums) {
        const dalle2ImageSizes = ['256x256', '512x512', '1024x1024'];
        const dalle3ImageSizes = ['1024x1024', '1792x1024', '1024x1792'];

        const imageSizesToDisplay = imageModel === imageModelEnums.DALLE3 ?  
            dalle3ImageSizes : dalle2ImageSizes;

        const buttons = imageSizesToDisplay.map(size => {
            return new ButtonBuilder()
                .setCustomId(size)
                .setLabel(size)
                .setStyle(ButtonStyle.Primary);
        });

        const row = new ActionRowBuilder()
            .addComponents(buttons);

        return row;
    }
};