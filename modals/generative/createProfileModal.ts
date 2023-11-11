import { ActionRowBuilder, ModalActionRowComponentBuilder, ModalBuilder, ModalSubmitInteraction, TextInputBuilder, TextInputStyle } from "discord.js";
import { PROFILE_PLACEHOLDER_TEXT } from "../../shared/constants";
import userProfilesDao from "../../database/user_profiles/userProfilesDao";
import { OpenAi } from "../..";
import { config } from "../../config";

export const NEW_PROFILE_MODAL_ID = 'newProfile';
export const PROFILE_NAME_ID = 'profileName';
export const PROFILE_ID = 'profile';


export default {
    generateNewProfileModal() {
        const modal = new ModalBuilder()
            .setCustomId(NEW_PROFILE_MODAL_ID)
            .setTitle('New Profile');
        
        const profileNameInput = new TextInputBuilder()
            .setCustomId(PROFILE_NAME_ID)
            .setLabel('Profile Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const profileInput = new TextInputBuilder()
            .setCustomId(PROFILE_ID)
            .setLabel('Profile')
            .setPlaceholder(PROFILE_PLACEHOLDER_TEXT)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(profileNameInput);
        const secondActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(profileInput);
        modal.addComponents(firstActionRow, secondActionRow);
        return modal;
    },

    async handleNewProfileInput(modalInteraction: ModalSubmitInteraction) {
        const { user } = modalInteraction ;
        const name = modalInteraction.fields.getTextInputValue(PROFILE_NAME_ID);
        const profile = modalInteraction.fields.getTextInputValue(PROFILE_ID);

        // creating a new openAI assistant. We will default to using the
        // code interpreter tool to start, but we will add the option for
        // other tools as assistants feature expands
        const {id: assistantId } = await OpenAi.beta.assistants.create({
            instructions: profile,
            name,
            tools: [{ type: "code_interpreter" }],
            model: config.openAi.chatCompletionModel,
        });

        await userProfilesDao.insertUserProfile({ name, profile, discordId: user.id, assistantId });
        return modalInteraction.reply({ content: `Your new profile **${name}** was added successfully!` });
    }
};