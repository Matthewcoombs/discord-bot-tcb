import {
  CollectedInteraction,
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { Command, optInCommands } from '../../shared/discord-js-types';
import userProfilesDao, {
  UserProfile,
} from '../../database/user_profiles/userProfilesDao';
import profilesService from '../../profiles/profiles.service';
import {
  InteractionTimeOutError,
  USER_TIMEOUT_CODE,
} from '../../shared/errors';

const selectGenerativeProfileCommand: Command = {
  data: new SlashCommandBuilder()
    .setName(optInCommands.SELECT_PROFILE)
    .setDescription('Select your desired profile'),
  async execute(interaction: CommandInteraction) {
    const { user } = interaction;
    const userProfiles = await userProfilesDao.getUserProfiles(user.id);
    if (userProfiles.length === 0) {
      return interaction.reply({
        content: `You don't have any profile(s).`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const actionRowComponent =
      profilesService.generateUserProfileDisplay(userProfiles);

    const selectResponse = await interaction.reply({
      content: `Select a profile`,
      components: [actionRowComponent as any],
      flags: MessageFlags.Ephemeral,
    });

    const collectorFilter = (message: CollectedInteraction) => {
      return message?.user?.id === user.id;
    };
    try {
      // If the user does not respond in 1 minutes (60000) the message is deleted.
      const profileToSelect = await selectResponse
        ?.awaitMessageComponent({
          filter: collectorFilter,
          time: 60000,
        })
        .catch(() => {
          throw new InteractionTimeOutError({
            error: `:warning: Profile selection cancelled. Selection timeout reached.`,
          });
        });
      const profileId = profileToSelect.customId;
      const selectedProfile = userProfiles.find(
        (profile) => profile.id === parseInt(profileId),
      ) as UserProfile;
      await userProfilesDao.updateProfileSelection(selectedProfile);

      await interaction.followUp({
        content: `Profile ${selectedProfile?.name} selected.`,
        flags: MessageFlags.Ephemeral,
      });
      await interaction?.deleteReply();
    } catch (err: any) {
      if (
        err?.code !== 'InteractionCollectorError' &&
        err?.errorData?.code !== USER_TIMEOUT_CODE
      ) {
        console.error(err);
        await interaction.followUp({
          content: `There was an error selecting your profile.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      await interaction.deleteReply();
    }
  },
};

export = selectGenerativeProfileCommand;
