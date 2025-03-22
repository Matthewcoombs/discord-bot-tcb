import {
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { Command, optInCommands } from '../../shared/discord-js-types';
import userProfilesDao from '../../database/user_profiles/userProfilesDao';
import profileModal from '../../modals/generative/profileModal';

const updateProfileCommand: Command = {
  data: new SlashCommandBuilder()
    .setName(optInCommands.UPDATE_PROFILE)
    .setDescription('Update personal profile for generative content'),
  async execute(interaction: CommandInteraction) {
    const { user } = interaction;
    const userProfiles = await userProfilesDao.getUserProfiles(user.id);
    const selectedProfile = userProfiles.find(
      (profile) => profile.selected === true,
    );
    if (userProfiles.length === 0 || !selectedProfile) {
      return interaction.reply({
        content: `You don't have any selected profile(s) to update`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const updateProfileModal =
      profileModal.generateProfileModal(selectedProfile);
    await interaction.showModal(updateProfileModal);
  },
};

export = updateProfileCommand;
