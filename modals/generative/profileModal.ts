import {
  ActionRowBuilder,
  MessageFlags,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import userProfilesDao, { UserProfile } from '../../database/user_profiles/userProfilesDao';
import { pg } from '../..';
import { aiServiceEnums, config } from '../../config';

export const NEW_PROFILE_MODAL_ID = 'newProfile';
export const UPDATE_PROFILE_MODAL_ID = 'updateProfile';
export const PROFILE_NAME_ID = 'profileName';
export const SERVICE_ID = 'service';
export const PROFILE_ID = 'profile';

const AI_SERVICE_PLACEHOLDER_TEXT = `The AI service your profile will use. Valid values [${Object.values(aiServiceEnums).join(', ')}]`;
const PROFILE_PLACEHOLDER_TEXT = `You're name is {name}. Your favorite color is {color}, you're
extremely good at...`;

export default {
  generateProfileModal(profileData?: UserProfile) {
    const modal = new ModalBuilder()
      .setCustomId(profileData ? UPDATE_PROFILE_MODAL_ID : NEW_PROFILE_MODAL_ID)
      .setTitle(profileData ? `Update Profile: ${profileData.name}` : 'New Profile');

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

    if (profileData) {
      profileNameInput.setValue(profileData.name);
      profileInput.setValue(profileData.profile);
    }

    const firstActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      profileNameInput,
    );
    const secondActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      profileInput,
    );
    modal.addComponents(firstActionRow, secondActionRow);

    // Only add the service input if the profileData is not provided.
    if (!profileData) {
      const serviceInput = new TextInputBuilder()
        .setCustomId(SERVICE_ID)
        .setLabel('AI Service')
        .setPlaceholder(AI_SERVICE_PLACEHOLDER_TEXT)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const thirdActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        serviceInput,
      );
      modal.addComponents(thirdActionRow);
    }

    return modal;
  },

  async handleNewProfileInput(modalInteraction: ModalSubmitInteraction) {
    const { user } = modalInteraction;
    const name = modalInteraction.fields.getTextInputValue(PROFILE_NAME_ID);
    const profile = modalInteraction.fields.getTextInputValue(PROFILE_ID);
    const service = modalInteraction.fields
      .getTextInputValue(SERVICE_ID)
      .trim()
      .toLowerCase() as aiServiceEnums;

    if (!Object.values(aiServiceEnums).includes(service)) {
      return modalInteraction.reply({
        content: `You have entered an incorrect **service** value. Please enter one of these valid values: [${Object.values(aiServiceEnums).join(', ')}]`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Handling transaction logic for creating a new profile.
    try {
      await pg.query('BEGIN');
      const newUserProfile = await userProfilesDao.insertUserProfile({
        name,
        profile,
        discordId: user.id,
        textModel:
          service === aiServiceEnums.OPENAI
            ? config.openAi.defaultChatCompletionModel
            : config.anthropic.defaultMessageModel,
        service,
      });

      const selectedProfile = await userProfilesDao.getSelectedProfile(user.id);
      // If no profile is currently selected, the most recently created profile will be selected.
      if (!selectedProfile) {
        await userProfilesDao.updateProfileSelection(newUserProfile);
      }
      await pg.query('COMMIT');
      return modalInteraction.reply({
        content: `Your new profile **${name}** was added successfully!`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      console.error(err);
      await pg.query('ROLLBACK');
    }
  },

  async handleUpdateModalInput(modalInteraction: ModalSubmitInteraction) {
    const { user } = modalInteraction;
    const updatedName = modalInteraction.fields.getTextInputValue(PROFILE_NAME_ID);
    const updatedProfile = modalInteraction.fields.getTextInputValue(PROFILE_ID);

    // Handling transaction logic for updating a profile.
    const originalSelectedProfile = await userProfilesDao.getSelectedProfile(user.id);
    try {
      await pg.query('BEGIN');
      const selectedProfileUpdateCopy: UserProfile = JSON.parse(
        JSON.stringify(originalSelectedProfile),
      );
      selectedProfileUpdateCopy.name = updatedName;
      selectedProfileUpdateCopy.profile = updatedProfile;
      await userProfilesDao.updateUserProfile(selectedProfileUpdateCopy);
      await pg.query('COMMIT');
      return modalInteraction.reply({
        content: `Profile: **${selectedProfileUpdateCopy.name}** has been updated.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      console.error(err);
      await pg.query('ROLLBACK');
    }
  },
};
