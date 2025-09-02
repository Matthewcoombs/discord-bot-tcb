import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  EmbedBuilder,
} from 'discord.js';
import { Command, optInCommands } from '../../shared/discord-js-types';
import userProfilesDao from '../../database/user_profiles/userProfilesDao';

const viewProfileSettingsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName(optInCommands.VIEW_PROFILE_SETTINGS)
    .setDescription('View all settings for your currently selected profile'),
  async execute(interaction: ChatInputCommandInteraction) {
    const { user } = interaction;

    const selectedProfile = await userProfilesDao.getSelectedProfile(user.id);
    if (!selectedProfile) {
      return interaction.reply({
        content: ':exclamation: You do not have any profile selected.',
        flags: MessageFlags.Ephemeral,
      });
    }

    let retentionValue: string;
    if (selectedProfile.retention === null) {
      retentionValue = 'Not set';
    } else {
      retentionValue = selectedProfile.retention ? 'Yes' : 'No';
    }

    const embed = new EmbedBuilder()
      .setTitle(`Profile Settings: ${selectedProfile.name || 'Unknown'}`)
      .setColor(0x0099ff)
      .addFields(
        { name: 'AI Service', value: selectedProfile.service || 'Not set', inline: true },
        { name: 'Text Model', value: selectedProfile.textModel || 'Not set', inline: true },
        {
          name: 'Temperature',
          value: selectedProfile.temperature?.toString() || 'Not set',
          inline: true,
        },
        {
          name: 'Chat Timeout',
          value: selectedProfile.timeout
            ? `${Math.floor(Number(selectedProfile.timeout) / 1000 / 60)} minutes`
            : 'Not set',
          inline: true,
        },
        {
          name: 'Retention Enabled',
          value: retentionValue,
          inline: true,
        },
        {
          name: 'Retention Size',
          value: selectedProfile.retentionSize?.toString() || 'Not set',
          inline: true,
        },
        {
          name: 'Created',
          value: selectedProfile.createdAt
            ? new Date(selectedProfile.createdAt).toLocaleDateString()
            : 'Unknown',
          inline: true,
        },
        {
          name: 'Last Updated',
          value: selectedProfile.updatedAt
            ? new Date(selectedProfile.updatedAt).toLocaleDateString()
            : 'Unknown',
          inline: true,
        },
      );

    if (selectedProfile.profile) {
      embed.addFields({
        name: 'Profile Description',
        value: selectedProfile.profile.substring(0, 1024),
      });
    }

    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export = viewProfileSettingsCommand;
