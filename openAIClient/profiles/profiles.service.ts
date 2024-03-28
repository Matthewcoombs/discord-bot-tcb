// import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SelectMenuBuilder, StringSelectMenuBuilder } from "discord.js";
// import { textBasedModelEnums } from "../../config";

export const SELECT_TEXT_MODEL_ID = 'textModel';


// export default {
//     generateModelSelectionDisplay(model?: string) {
//         const modelButtons: ButtonBuilder[] = [];
//         for (const textModel in textBasedModelEnums) {
//             const modelVal = textBasedModelEnums[textModel as keyof typeof textBasedModelEnums];
//             modelButtons.push(
//                 new StringSelectMenuBuilder()
//                     .setCustomId(SELECT_TEXT_MODEL_ID)
//                     .setPlaceholder('Select Text Based Model')
//                     .setStyle(model ? ButtonStyle.Success : ButtonStyle.Primary)
//             );
            
//         }

//         const row = new ActionRowBuilder()
//             .addComponents(modelButtons);
//         return row;
//     }
// };