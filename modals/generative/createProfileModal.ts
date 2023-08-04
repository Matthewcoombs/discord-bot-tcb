import { ActionRowBuilder, ModalActionRowComponentBuilder, ModalBuilder, ModalSubmitInteraction, TextInputBuilder, TextInputStyle } from "discord.js";
import { PROFILE_PLACEHOLDER_TEXT } from "../../shared/constants";
import userProfilesDao from "../../database/user_profiles/userProfilesDao";

export const NEW_PROFILE_MODAL_ID = 'newProfile';
export const PROFILE_NAME_ID = 'profileName';
export const PROFILE_ID = 'profile';


export default {
    generateNewProfileModal() {
        const modal = new ModalBuilder()
            .setCustomId(NEW_PROFILE_MODAL_ID)
            .setTitle('New Profile')
        
        const profileNameInput = new TextInputBuilder()
            .setCustomId(PROFILE_NAME_ID)
            .setLabel('Profile Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)

        const profileInput = new TextInputBuilder()
            .setCustomId(PROFILE_ID)
            .setLabel('Profile')
            .setPlaceholder(PROFILE_PLACEHOLDER_TEXT)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)

        const firstActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(profileNameInput);
        const secondActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(profileInput);
        modal.addComponents(firstActionRow, secondActionRow);
        return modal;
    },

    async handleNewProfileInput(modalInteraction: ModalSubmitInteraction) {
        const { user } = modalInteraction ;
        const name = modalInteraction.fields.getTextInputValue(PROFILE_NAME_ID);
        const profile = modalInteraction.fields.getTextInputValue(PROFILE_ID);
        await userProfilesDao.insertUserProfile({ name, profile, discordId: user.id })
        return modalInteraction.reply({ content: `Your new profile **${name}** was added successfully!` });
    }
}