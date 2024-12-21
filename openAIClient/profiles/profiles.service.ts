import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import {
  aiServiceEnums,
  CLAUDE_TEXT_MODELS,
  config,
  OPEN_AI_TEXT_MODELS,
  textBasedModelEnums,
} from '../../config';
import {
  CHAT_TIMEOUT_OPTIONS,
  DEFAULT_CHAT_TIMEOUT,
  DEFAULT_RETENTION_SIZE,
  RETENTION_SIZE_OPTIONS,
} from '../../shared/constants';
import userProfilesDao, {
  UserProfile,
} from '../../database/user_profiles/userProfilesDao';
import { OpenAi } from '../..';

export const SELECT_AI_SERVICE_ID = 'service';
export const SELECT_TEXT_MODEL_ID = 'textModel';
export const SELECT_CHAT_TIMEOUT_ID = 'timeout';
export const SELECT_RETENTION_ID = 'retention';
export const SELECT_RETENTION_SIZE_ID = 'retentionSize';
export const CLEAR_RETENTION_DATA = 'clearRetentionData';

export default {
  generateAIServiceSelectionDisplay(selectedService?: string) {
    const serviceOptions = [aiServiceEnums.ANTHROPIC, aiServiceEnums.OPENAI];
    const serviceButtons: ButtonBuilder[] = [];

    for (let i = 0; i <= serviceOptions.length - 1; i++) {
      const service = serviceOptions[i];
      serviceButtons.push(
        new ButtonBuilder()
          .setCustomId(service)
          .setLabel(service)
          .setStyle(
            selectedService === service
              ? ButtonStyle.Success
              : ButtonStyle.Primary,
          ),
      );
    }

    const row = new ActionRowBuilder().addComponents(serviceButtons);
    return {
      displayMsg: `Profile Service :service_dog:`,
      row,
    };
  },
  generateTextModelSelectionDisplay(service: string, selectedModel?: string) {
    const modelButtons: ButtonBuilder[] = [];
    const textBasedModelOptions =
      service === aiServiceEnums.OPENAI
        ? OPEN_AI_TEXT_MODELS
        : CLAUDE_TEXT_MODELS;
    for (let i = 0; i <= textBasedModelOptions.length - 1; i++) {
      const model = textBasedModelOptions[i];
      modelButtons.push(
        new ButtonBuilder()
          .setCustomId(model)
          .setLabel(model)
          .setStyle(
            selectedModel === model ? ButtonStyle.Success : ButtonStyle.Primary,
          ),
      );
    }

    const row = new ActionRowBuilder().addComponents(modelButtons);
    return {
      displayMsg: `Profile Model :wrench:`,
      row,
    };
  },

  generateTextModelChatTimeout(selectedTimeout?: string) {
    const numSelectedTimeout = selectedTimeout
      ? Number(selectedTimeout)
      : DEFAULT_CHAT_TIMEOUT;
    const timeoutButtons: ButtonBuilder[] = [];
    for (let i = 0; i < CHAT_TIMEOUT_OPTIONS.length; i++) {
      const timeoutVal = CHAT_TIMEOUT_OPTIONS[i];
      timeoutButtons.push(
        new ButtonBuilder()
          .setCustomId(timeoutVal.toString())
          .setLabel(`${timeoutVal / 60000} minutes`)
          .setStyle(
            timeoutVal === numSelectedTimeout
              ? ButtonStyle.Success
              : ButtonStyle.Primary,
          ),
      );
    }

    const row = new ActionRowBuilder().addComponents(timeoutButtons);
    return {
      displayMsg: `Profile Chat Timeout :timer:`,
      row,
    };
  },

  generateRetentionProfileSetting(retentionSetting?: boolean) {
    const retention = retentionSetting ? retentionSetting : false;
    const retentionButtons: ButtonBuilder[] = [];
    const retentionOptions = [true, false];
    for (let i = 0; i < retentionOptions.length; i++) {
      const optVal = retentionOptions[i];
      retentionButtons.push(
        new ButtonBuilder()
          .setCustomId(optVal.toString())
          .setLabel(optVal.toString())
          .setStyle(
            optVal === retention ? ButtonStyle.Success : ButtonStyle.Primary,
          ),
      );
    }

    const row = new ActionRowBuilder().addComponents(retentionButtons);
    return {
      displayMsg: `Profile Retention :brain:`,
      row,
    };
  },

  generateRetentionSizeProfileSetting(retentionSizeSetting?: number) {
    const retentionSize = retentionSizeSetting
      ? retentionSizeSetting
      : DEFAULT_RETENTION_SIZE;
    const retentionSizeButtons: ButtonBuilder[] = [];
    for (let i = 0; i < RETENTION_SIZE_OPTIONS.length; i++) {
      const optVal = RETENTION_SIZE_OPTIONS[i];
      retentionSizeButtons.push(
        new ButtonBuilder()
          .setCustomId(optVal.toString())
          .setLabel(optVal.toString())
          .setStyle(
            optVal === retentionSize
              ? ButtonStyle.Success
              : ButtonStyle.Primary,
          ),
      );
    }

    const row = new ActionRowBuilder().addComponents(retentionSizeButtons);
    return {
      displayMsg: `Profile Retention Size :ledger:`,
      row,
    };
  },

  generateClearRetentionDataSetting() {
    const clearRetentionDataButton: ButtonBuilder = new ButtonBuilder()
      .setCustomId('true')
      .setLabel('Clear Data')
      .setStyle(ButtonStyle.Primary);

    const cancelButton: ButtonBuilder = new ButtonBuilder()
      .setCustomId('false')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents([
      clearRetentionDataButton,
      cancelButton,
    ]);
    return {
      displayMsg: `Clear Retention Data :broom:`,
      row,
    };
  },

  processSettingsDisplay(setting: string, selectedProfile: UserProfile) {
    switch (setting) {
      case SELECT_AI_SERVICE_ID:
        return this.generateAIServiceSelectionDisplay(selectedProfile.service);
      case SELECT_TEXT_MODEL_ID:
        return this.generateTextModelSelectionDisplay(
          selectedProfile.service,
          selectedProfile.textModel,
        );
      case SELECT_CHAT_TIMEOUT_ID:
        return this.generateTextModelChatTimeout(
          selectedProfile.timeout as string,
        );
      case SELECT_RETENTION_ID:
        return this.generateRetentionProfileSetting(selectedProfile.retention);
      case SELECT_RETENTION_SIZE_ID:
        return this.generateRetentionSizeProfileSetting(
          selectedProfile.retentionSize as number,
        );
      case CLEAR_RETENTION_DATA:
        return this.generateClearRetentionDataSetting();
      default:
        break;
    }
  },

  async processUpdateUserProfile(
    setting: string,
    selectedProfile: UserProfile,
    updateValue: string,
  ) {
    switch (setting) {
      case SELECT_AI_SERVICE_ID: {
        const prevServiceVal = selectedProfile.service;
        // if the service value has changed we update the service AND default text
        // model associated with the service
        if (prevServiceVal !== updateValue) {
          selectedProfile.service = updateValue as aiServiceEnums;
          selectedProfile.textModel =
            selectedProfile.service === aiServiceEnums.OPENAI
              ? config.openAi.defaultChatCompletionModel
              : config.claude.defaultMessageModel;
          await userProfilesDao.updateUserProfile(selectedProfile);
        }
        break;
      }
      case SELECT_TEXT_MODEL_ID: {
        selectedProfile.textModel = updateValue as textBasedModelEnums;
        await Promise.all([
          userProfilesDao.updateUserProfile(selectedProfile),
          OPEN_AI_TEXT_MODELS.includes(selectedProfile.textModel)
            ? OpenAi.beta.assistants.update(selectedProfile.assistantId, {
                model: selectedProfile.textModel,
              })
            : null,
        ]);
        break;
      }
      case SELECT_CHAT_TIMEOUT_ID: {
        selectedProfile.timeout = Number(updateValue);
        await userProfilesDao.updateUserProfile(selectedProfile);
        break;
      }
      case SELECT_RETENTION_ID: {
        selectedProfile.retention = updateValue === 'true';
        await userProfilesDao.updateUserProfile(selectedProfile);
        break;
      }
      case SELECT_RETENTION_SIZE_ID: {
        selectedProfile.retentionSize = Number(updateValue);
        await userProfilesDao.updateUserProfile(selectedProfile);
        break;
      }
      case CLEAR_RETENTION_DATA: {
        updateValue === 'true'
          ? await userProfilesDao.clearProfileRetentionData(selectedProfile)
          : null;
        break;
      }
      default:
        break;
    }
  },
};
