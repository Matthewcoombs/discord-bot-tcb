import {
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {
  AI_SERVICE_PLACEHOLDER_TEXT,
  PROFILE_PLACEHOLDER_TEXT,
} from '../../shared/constants';
import userProfilesDao, {
  UserProfile,
} from '../../database/user_profiles/userProfilesDao';
import { OpenAi, pg } from '../..';
import { aiServiceEnums, config } from '../../config';
import {
  Assistant,
  AssistantCreateParams,
  AssistantUpdateParams,
} from 'openai/resources/beta/assistants';
import { Thread } from 'openai/resources/beta/threads/threads';

export const NEW_PROFILE_MODAL_ID = 'newProfile';
export const UPDATE_PROFILE_MODAL_ID = 'updateProfile';
export const PROFILE_NAME_ID = 'profileName';
export const SERVICE_ID = 'service';
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

    const serviceInput = new TextInputBuilder()
      .setCustomId(SERVICE_ID)
      .setLabel('AI Service')
      .setPlaceholder(AI_SERVICE_PLACEHOLDER_TEXT)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    if (profileData) {
      profileNameInput.setValue(profileData.name);
      profileInput.setValue(profileData.profile);
      serviceInput.setValue(profileData.service);
    }

    const firstActionRow =
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        profileNameInput,
      );
    const secondActionRow =
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        profileInput,
      );
    const thirdActionRow =
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        serviceInput,
      );

    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);
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
        content: `You have entered an incorrect **service** value. Please enter either "openai", or "anthropic"`,
        ephemeral: true,
      });
    }

    // creating a new openAI assistant, and assistant thread.
    const assistantPayload: AssistantCreateParams = {
      instructions: profile,
      name,
      tools: [{ type: 'code_interpreter' }],
      model: config.openAi.defaultChatCompletionModel,
    };

    // Handling transaction logic for creating a new profile.
    let assistant: Assistant | undefined = undefined;
    let thread: Thread | undefined = undefined;
    // const pgTransactionClient = await new Pool().connect();
    try {
      await pg.query('BEGIN');
      [assistant, thread] = await Promise.all([
        OpenAi.beta.assistants.create(assistantPayload),
        OpenAi.beta.threads.create(),
      ]);

      const { id: assistantId } = assistant;
      const { id: threadId } = thread;
      const newUserProfile = await userProfilesDao.insertUserProfile({
        name,
        profile,
        discordId: user.id,
        textModel:
          service === aiServiceEnums.OPENAI
            ? config.openAi.defaultChatCompletionModel
            : config.claude.defaultMessageModel,
        assistantId,
        threadId,
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
        ephemeral: true,
      });
    } catch (err) {
      console.error(err);
      await Promise.all([
        assistant?.id
          ? OpenAi.beta.assistants.del(assistant.id)
          : Promise.resolve(),
        thread?.id ? OpenAi.beta.threads.del(thread.id) : Promise.resolve(),
      ]);
      await pg.query('ROLLBACK');
    }
  },

  async handleUpdateModalInput(modalInteraction: ModalSubmitInteraction) {
    const { user } = modalInteraction;
    const updatedName =
      modalInteraction.fields.getTextInputValue(PROFILE_NAME_ID);
    const updatedProfile =
      modalInteraction.fields.getTextInputValue(PROFILE_ID);
    const service = modalInteraction.fields
      .getTextInputValue(SERVICE_ID)
      .trim()
      .toLowerCase() as aiServiceEnums;

    if (!Object.values(aiServiceEnums).includes(service)) {
      return modalInteraction.reply({
        content: `You have entered an incorrect **service** value. Please enter either "openai", or "anthropic"`,
        ephemeral: true,
      });
    }

    // Handling transaction logic for updating a profile.
    const originalSelectedProfile = await userProfilesDao.getSelectedProfile(
      user.id,
    );
    try {
      await pg.query('BEGIN');
      const selectedProfileUpdateCopy: UserProfile = JSON.parse(
        JSON.stringify(originalSelectedProfile),
      );
      selectedProfileUpdateCopy.name = updatedName;
      selectedProfileUpdateCopy.profile = updatedProfile;
      selectedProfileUpdateCopy.service = service;
      selectedProfileUpdateCopy.textModel =
        service === aiServiceEnums.OPENAI
          ? config.openAi.defaultChatCompletionModel
          : config.claude.defaultMessageModel;

      const assistantUpdateParams: AssistantUpdateParams = {
        name: updatedName,
        instructions: updatedProfile,
      };
      await Promise.all([
        await OpenAi.beta.assistants.update(
          selectedProfileUpdateCopy.assistantId,
          assistantUpdateParams,
        ),
        await userProfilesDao.updateUserProfile(selectedProfileUpdateCopy),
      ]);
      await pg.query('COMMIT');
      return modalInteraction.reply({
        content: `Profile: **${selectedProfileUpdateCopy.name}** has been updated.`,
        ephemeral: true,
      });
    } catch (err) {
      console.error(err);
      await pg.query('ROLLBACK');
      await OpenAi.beta.assistants.update(originalSelectedProfile.assistantId, {
        name: originalSelectedProfile.name,
        instructions: originalSelectedProfile.profile,
      });
    }
  },
};
