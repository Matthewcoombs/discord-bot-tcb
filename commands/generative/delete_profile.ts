import {
  ButtonInteraction,
  CollectedInteraction,
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { Command, optInCommands } from '../../shared/discord-js-types';
import userProfilesDao from '../../database/user_profiles/userProfilesDao';
import profilesService from '../../profiles/profiles.service';

const deleteGenerativeProfileCommand: Command = {
  data: new SlashCommandBuilder()
    .setName(optInCommands.DELETE_PROFILE)
    .setDescription('Delete your user profile(s)'),
  async execute(interaction: CommandInteraction) {
    const { user } = interaction;
    const userProfiles = await userProfilesDao.getUserProfiles(user.id);
    if (userProfiles.length === 0) {
      return interaction.reply({
        content: `You don't have any profile(s) to delete`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const actionRowComponent =
      profilesService.generateUserProfileDisplay(userProfiles);

    const response = await interaction.reply({
      content: `Select a profile to delete`,
      components: [actionRowComponent as any],
      flags: MessageFlags.Ephemeral,
    });

    const collectorFilter = (message: CollectedInteraction) => {
      return message?.user?.id === user.id;
    };
    try {
      // If the user does not respond in 1 minutes (60000) the message is deleted.
      const userProfileToDelete = (await response?.awaitMessageComponent({
        filter: collectorFilter,
        time: 60000,
      })) as ButtonInteraction;
      const profileId = userProfileToDelete.customId;
      await userProfilesDao.deleteUserProfile(profileId);
      await interaction.followUp({
        content: `The profile has been deleted.`,
        flags: MessageFlags.Ephemeral,
      });
      await interaction?.deleteReply();
    } catch (err: any) {
      if (err?.code !== 'InteractionCollectorError') {
        console.error(err);
        await interaction.followUp({
          content: `There was an error deleting your selected profile.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      await interaction.deleteReply();
    }
  },
};

export = deleteGenerativeProfileCommand;
