import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  CollectedInteraction,
  SlashCommandStringOption,
  ButtonInteraction,
  MessageFlags,
} from 'discord.js';
import { Command, optInCommands } from '../../shared/discord-js-types';
import userProfilesDao from '../../database/user_profiles/userProfilesDao';
import profilesService, {
  CLEAR_RETENTION_DATA,
  SELECT_AI_SERVICE_ID,
  SELECT_CHAT_TIMEOUT_ID,
  SELECT_PROFILE_TEMPERATURE,
  SELECT_RETENTION_ID,
  SELECT_RETENTION_SIZE_ID,
  SELECT_TEXT_MODEL_ID,
} from '../../profiles/profiles.service';

const selectProfileModelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName(optInCommands.SELECT_PROFILE_SETTINGS)
    .setDescription(`Update you selected profile's settings`)
    .addStringOption((strOption: SlashCommandStringOption) =>
      strOption
        .setName('profile_setting')
        .setDescription('The profile setting you would like to update')
        .setRequired(true)
        .addChoices(
          {
            name: 'ai service',
            value: SELECT_AI_SERVICE_ID,
          },
          {
            name: 'text model',
            value: SELECT_TEXT_MODEL_ID,
          },
          {
            name: 'chat timeout',
            value: SELECT_CHAT_TIMEOUT_ID,
          },
          {
            name: 'profile temperature',
            value: SELECT_PROFILE_TEMPERATURE,
          },
          {
            name: 'profile retention',
            value: SELECT_RETENTION_ID,
          },
          {
            name: 'profile retention size',
            value: SELECT_RETENTION_SIZE_ID,
          },
          {
            name: 'clear retention data',
            value: CLEAR_RETENTION_DATA,
          },
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const { user } = interaction;
    const { chatInstanceCollector } = interaction.client;
    const userMessageInstance = chatInstanceCollector.get(user.id);
    // Disabling the use of this command when the user is in a current chat instance
    if (userMessageInstance) {
      return interaction.reply({
        content: `:exclamation: Updating profile settings through the slash command is disabled while in a current chat.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const profileSetting = await interaction.options.getString(
      'profile_setting',
      true,
    );
    const selectedProfile = await userProfilesDao.getSelectedProfile(user.id);
    if (!selectedProfile) {
      return interaction.reply({
        content: `:exclamation: You do not have any profile selected to update a model`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const settingsReply = profilesService.processSettingsDisplay(
      profileSetting,
      selectedProfile,
    );
    const settingResponse = await interaction.reply({
      content: settingsReply?.displayMsg,
      components: [settingsReply?.row as any],
      flags: MessageFlags.Ephemeral,
    });

    const collectorFilter = (message: CollectedInteraction) => {
      return message?.user?.id === interaction.user.id;
    };
    const userSettingChoice = (await settingResponse
      .awaitMessageComponent({
        filter: collectorFilter,
        time: 120000,
      })
      .catch(() => {
        return settingResponse.edit({
          content: `Response timeout reached. No profile updates were applied`,
          components: [],
        });
      })) as ButtonInteraction;

    const settingVal = userSettingChoice.customId;
    if (!settingVal) {
      return;
    }
    await profilesService.processUpdateUserProfile(
      profileSetting,
      selectedProfile,
      settingVal,
    );
    return await settingResponse.edit({
      content: `Profile settings for **${selectedProfile.name}** were updated successfully!`,
      components: [],
    });
  },
};

export = selectProfileModelCommand;
