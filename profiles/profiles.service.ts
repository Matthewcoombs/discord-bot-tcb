import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import {
  aiServiceEnums,
  CLAUDE_TEXT_MODELS,
  config,
  OPEN_AI_TEXT_MODELS,
  textBasedModelEnums,
} from '../config';
import userProfilesDao, { UserProfile } from '../database/user_profiles/userProfilesDao';

export const SELECT_AI_SERVICE_ID = 'service';
export const SELECT_TEXT_MODEL_ID = 'textModel';
export const SELECT_CHAT_TIMEOUT_ID = 'timeout';
export const SELECT_RETENTION_ID = 'retention';
export const SELECT_RETENTION_SIZE_ID = 'retentionSize';
export const CLEAR_RETENTION_DATA = 'clearRetentionData';
export const SELECT_PROFILE_TEMPERATURE = 'temperature';

function convertAIServiceTemperature(selectedProfile: UserProfile) {
  if (!selectedProfile.temperature) {
    return;
  }
  const selectedService = selectedProfile.service;
  const temperatureRange =
    selectedService === aiServiceEnums.OPENAI
      ? config.openAi.temperatureRange
      : config.anthropic.temperatureRange;

  const temperatureOptions: number[] = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const interpolatedValue = temperatureRange[0] + t * (temperatureRange[1] - temperatureRange[0]);
    temperatureOptions.push(Number(interpolatedValue.toFixed(2)));
  }

  selectedProfile.temperature =
    selectedService === aiServiceEnums.OPENAI
      ? selectedProfile.temperature * 2
      : selectedProfile.temperature / 2;
}

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
          .setStyle(selectedService === service ? ButtonStyle.Success : ButtonStyle.Primary),
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
      service === aiServiceEnums.OPENAI ? OPEN_AI_TEXT_MODELS : CLAUDE_TEXT_MODELS;
    for (let i = 0; i <= textBasedModelOptions.length - 1; i++) {
      const model = textBasedModelOptions[i];
      modelButtons.push(
        new ButtonBuilder()
          .setCustomId(model)
          .setLabel(model)
          .setStyle(selectedModel === model ? ButtonStyle.Success : ButtonStyle.Primary),
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
      : config.defaults.chatTimeout;
    const timeoutButtons: ButtonBuilder[] = [];
    const { chatTimeoutOptions } = config;
    for (let i = 0; i < chatTimeoutOptions.length; i++) {
      const timeoutVal = chatTimeoutOptions[i];
      timeoutButtons.push(
        new ButtonBuilder()
          .setCustomId(timeoutVal.toString())
          .setLabel(`${timeoutVal / 60000} minutes`)
          .setStyle(timeoutVal === numSelectedTimeout ? ButtonStyle.Success : ButtonStyle.Primary),
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
          .setStyle(optVal === retention ? ButtonStyle.Success : ButtonStyle.Primary),
      );
    }

    const row = new ActionRowBuilder().addComponents(retentionButtons);
    return {
      displayMsg: `Profile Retention :brain:`,
      row,
    };
  },

  generateRetentionSizeProfileSetting(retentionSizeSetting?: number) {
    const retentionSize =
      typeof retentionSizeSetting === 'number'
        ? retentionSizeSetting
        : config.defaults.retentionSize;
    const retentionSizeButtons: ButtonBuilder[] = [];
    const { retentionSizeOptions } = config;
    for (let i = 0; i < retentionSizeOptions.length; i++) {
      const optVal = retentionSizeOptions[i];
      retentionSizeButtons.push(
        new ButtonBuilder()
          .setCustomId(optVal.toString())
          .setLabel(optVal === 0 ? 'optimized' : optVal.toString())
          .setStyle(optVal === retentionSize ? ButtonStyle.Success : ButtonStyle.Primary),
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

    const row = new ActionRowBuilder().addComponents([clearRetentionDataButton, cancelButton]);
    return {
      displayMsg: `Clear Retention Data :broom:`,
      row,
    };
  },

  generateProfileTemperatureSetting(
    service: aiServiceEnums,
    temperatureSetting?: string | number | undefined,
  ) {
    // Openai and Anthropic have the same default temperature value of 1, so if
    // the temperature is not set, we default to 1
    const temperature = temperatureSetting ? temperatureSetting : 1;
    const profileTemperatureButtons: ButtonBuilder[] = [];
    const temperatureOptions =
      service === aiServiceEnums.OPENAI
        ? config.openAi.temperatureOptions
        : config.anthropic.temperatureOptions;

    // temperatureOptions is an array of numbers from 0 to 4 (or 1-5).
    for (const tempOption of temperatureOptions) {
      const index = temperatureOptions.indexOf(tempOption);
      let tempLabel: string = '';
      let tempEmoji: string = '';
      switch (index) {
        case 0: {
          tempLabel = 'precise';
          tempEmoji = '🎯';
          break;
        }
        case 1: {
          tempLabel = 'structured';
          tempEmoji = '📋';
          break;
        }
        case 2: {
          tempLabel = 'balanced';
          tempEmoji = '⚖️';
          break;
        }
        case 3: {
          tempLabel = 'explorative';
          tempEmoji = '🔍';
          break;
        }
        case 4: {
          tempLabel = 'creative';
          tempEmoji = '🎨';
          break;
        }
      }

      profileTemperatureButtons.push(
        new ButtonBuilder()
          .setCustomId(tempOption.toString())
          .setLabel(tempLabel)
          .setEmoji(tempEmoji)
          .setStyle(Number(temperature) === tempOption ? ButtonStyle.Success : ButtonStyle.Primary),
      );
    }

    const row = new ActionRowBuilder().addComponents(profileTemperatureButtons);
    return {
      displayMsg: `Profile Temperature :thermometer:`,
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
        return this.generateTextModelChatTimeout(selectedProfile.timeout as string);
      case SELECT_RETENTION_ID:
        return this.generateRetentionProfileSetting(selectedProfile.retention);
      case SELECT_RETENTION_SIZE_ID:
        return this.generateRetentionSizeProfileSetting(selectedProfile.retentionSize as number);
      case CLEAR_RETENTION_DATA:
        return this.generateClearRetentionDataSetting();
      case SELECT_PROFILE_TEMPERATURE:
        return this.generateProfileTemperatureSetting(
          selectedProfile.service,
          selectedProfile.temperature,
        );
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
              : config.anthropic.defaultMessageModel;
          selectedProfile;
          convertAIServiceTemperature(selectedProfile);
        }
        break;
      }
      case SELECT_TEXT_MODEL_ID: {
        selectedProfile.textModel = updateValue as textBasedModelEnums;
        break;
      }
      case SELECT_CHAT_TIMEOUT_ID: {
        selectedProfile.timeout = Number(updateValue);
        break;
      }
      case SELECT_RETENTION_ID: {
        selectedProfile.retention = updateValue === 'true';
        break;
      }
      case SELECT_RETENTION_SIZE_ID: {
        selectedProfile.retentionSize = Number(updateValue);
        break;
      }
      case CLEAR_RETENTION_DATA: {
        if (updateValue === 'true') {
          selectedProfile.optimizedOpenAiRetentionData = '';
          selectedProfile.optimizedAnthropicRetentionData = '';
          selectedProfile.openAiRetentionData = [];
          selectedProfile.anthropicRetentionData = [];
        }
        break;
      }
      case SELECT_PROFILE_TEMPERATURE: {
        selectedProfile.temperature = Number(updateValue);
        break;
      }
      default:
        break;
    }
    await userProfilesDao.updateUserProfile(selectedProfile);
  },

  generateUserProfileDisplay(userProfiles: UserProfile[]) {
    const buttons = userProfiles.map(profile => {
      return new ButtonBuilder()
        .setCustomId(profile.id.toString())
        .setLabel(profile.name)
        .setStyle(profile.selected ? ButtonStyle.Success : ButtonStyle.Primary);
    });

    const row = new ActionRowBuilder().addComponents(buttons);

    return row;
  },
};
