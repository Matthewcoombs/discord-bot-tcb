import {
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { Command, optInCommands } from '../../shared/discord-js-types';
import userProfilesDao, {
  validateUserProfileCount,
} from '../../database/user_profiles/userProfilesDao';
import profileModal from '../../modals/generative/profileModal';
import { config } from '../../config';

const createAProfileCommand: Command = {
  data: new SlashCommandBuilder()
    .setName(optInCommands.CREATE_PROFILE)
    .setDescription('Create a new personal profile for generative content'),
  async execute(interaction: CommandInteraction) {
    const { user } = interaction;

    const userProfiles = await userProfilesDao.getUserProfiles(user.id);
    if (!validateUserProfileCount(userProfiles)) {
      return interaction.reply({
        content: `You have reached the maximum profile limit of ${config.profilesLimit}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const newProfileModal = profileModal.generateProfileModal();

    await interaction.showModal(newProfileModal);
  },
};

export = createAProfileCommand;
