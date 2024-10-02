import {
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {
  GENERATIVE_RESPONSE_CONSTRAINTS,
  PROFILE_PLACEHOLDER_TEXT,
} from '../../shared/constants';
import userProfilesDao, {
  UserProfile,
} from '../../database/user_profiles/userProfilesDao';
import { OpenAi } from '../..';
import { config } from '../../config';
import { AssistantCreateParams } from 'openai/resources/beta/assistants';

export const NEW_PROFILE_MODAL_ID = 'newProfile';
export const UPDATE_PROFILE_MODAL_ID = 'updateProfile';
export const PROFILE_NAME_ID = 'profileName';
export const PROFILE_ID = 'profile';
export const IS_DEFAULT_ID = 'default';

export default {
  generateProfileModal(profileData?: UserProfile) {
    const modal = new ModalBuilder()
      .setCustomId(profileData ? UPDATE_PROFILE_MODAL_ID : NEW_PROFILE_MODAL_ID)
      .setTitle(
        profileData ? `Update Profile: ${profileData.name}` : 'New Profile',
      );

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

    const firstActionRow =
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        profileNameInput,
      );
    const secondActionRow =
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        profileInput,
      );
    modal.addComponents(firstActionRow, secondActionRow);
    return modal;
  },

  async handleNewProfileInput(modalInteraction: ModalSubmitInteraction) {
    const { user } = modalInteraction;
    const name = modalInteraction.fields.getTextInputValue(PROFILE_NAME_ID);
    let profile = modalInteraction.fields.getTextInputValue(PROFILE_ID);

    // appending additional instructions to ensure the bot response does NOT exceed
    // discords limit of 2000 characters
    profile += GENERATIVE_RESPONSE_CONSTRAINTS;

    // creating a new openAI assistant, and assistant thread.
    const assistantPayload: AssistantCreateParams = {
      instructions: profile,
      name,
      tools: [{ type: 'code_interpreter' }],
      model: config.openAi.defaultChatCompletionModel,
    };

    const [assistant, thread] = await Promise.all([
      OpenAi.beta.assistants.create(assistantPayload),
      OpenAi.beta.threads.create(),
    ]);

    const { id: assistantId } = assistant;
    const { id: threadId } = thread;

    await userProfilesDao.insertUserProfile({
      name,
      profile,
      discordId: user.id,
      assistantId,
      threadId,
    });
    return modalInteraction.reply({
      content: `Your new profile **${name}** was added successfully!`,
    });
  },

  async handleUpdateModalInput(modalInteraction: ModalSubmitInteraction) {
    const { user } = modalInteraction;
    const updatedName =
      modalInteraction.fields.getTextInputValue(PROFILE_NAME_ID);
    let updatedProfile = modalInteraction.fields.getTextInputValue(PROFILE_ID);

    // appending additional instructions to ensure the bot response does NOT exceed
    // discords limit of 2000 characters
    updatedProfile += GENERATIVE_RESPONSE_CONSTRAINTS;

    const selectedProfile = await userProfilesDao.getSelectedProfile(user.id);
    selectedProfile.name = updatedName;
    selectedProfile.profile = updatedProfile;

    await OpenAi.beta.assistants.update(selectedProfile.assistantId, {
      name: updatedName,
      instructions: updatedProfile,
    });

    await userProfilesDao.updateUserProfile(selectedProfile);
    return modalInteraction.reply({
      content: `Profile: ${selectedProfile.name} has been updated.`,
      ephemeral: true,
    });
  },
};
