import {
  ButtonInteraction,
  CollectedInteraction,
  CommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { Command, optInCommands } from '../../shared/discord-js-types';
import userProfilesDao, {
  UserProfile,
} from '../../database/user_profiles/userProfilesDao';
import chatCompletionService from '../../openAIClient/chatCompletion/chatCompletion.service';

const selectGenerativeProfileCommand: Command = {
  data: new SlashCommandBuilder()
    .setName(optInCommands.SELECT_PROFILE)
    .setDescription('Select your desired profile'),
  async execute(interaction: CommandInteraction) {
    const { user } = interaction;
    const userProfiles = await userProfilesDao.getUserProfiles(user.id);
    if (userProfiles.length === 0) {
      return interaction.reply({
        content: `You dont have any profile(s).`,
        ephemeral: true,
      });
    }

    const actionRowComponent =
      chatCompletionService.generateUserProfileDisplay(userProfiles);

    const selectResponse = await interaction.reply({
      content: `Select a profile`,
      components: [actionRowComponent as any],
      ephemeral: true,
    });

    const collectorFilter = (message: CollectedInteraction) => {
      return message?.user?.id === user.id;
    };
    try {
      // If the user does not respond in 1 minutes (60000) the message is deleted.
      const profileToSelect = (await selectResponse?.awaitMessageComponent({
        filter: collectorFilter,
        time: 60000,
      })) as ButtonInteraction;
      const profileId = profileToSelect.customId;
      const selectedProfile = userProfiles.find(
        (profile) => profile.id === parseInt(profileId),
      ) as UserProfile;
      await userProfilesDao.updateProfileSelection(selectedProfile);

      await interaction.followUp({
        content: `Profile ${selectedProfile?.name} selected.`,
        ephemeral: true,
      });
      await interaction?.deleteReply();
    } catch (err) {
      console.error(err);
      await interaction.deleteReply();
      await interaction.followUp({
        content: `There was an error selecting your profile.`,
        ephemeral: true,
      });
    }
  },
};

export = selectGenerativeProfileCommand;
