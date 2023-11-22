import { ButtonInteraction, CollectedInteraction, CommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command, optInCommands } from "../../shared/discord-js-types";
import userProfilesDao from "../../database/user_profiles/userProfilesDao";
import createProfileModal from "../../modals/generative/createProfileModal";
import chatCompletionService from "../../openAIClient/chatCompletion/chatCompletion.service";
// import { OpenAi } from "../..";



const updateProfileCommand: Command = {
    data: new SlashCommandBuilder()
        .setName(optInCommands.UPDATE_PROFILE)
        .setDescription('Update personal profile for generative content'),
    async execute(interaction: CommandInteraction) {
        const { user } = interaction;
        const userProfiles = await userProfilesDao.getUserProfiles(user.id);
        if (userProfiles.length === 0) {
            return interaction.reply({
                content: `You dont have any profile(s) to update`,
                ephemeral: true,
            });
        }

        const actionRowComponent = chatCompletionService.generateUserProfileDisplay(userProfiles);

        const profileSelectionResponse = await interaction.reply({
            content: `Select a profile to delete`,
            components: [actionRowComponent as any],
            ephemeral: true,
        });
        const collectorFilter = (message: CollectedInteraction) => { return message?.user?.id === user.id;};
        try {
            // If the user does not respond in 1 minutes (60000) the message is deleted.
            const userProfileToUpdate = await profileSelectionResponse?.awaitMessageComponent({
                filter: collectorFilter,
                time: 60000,
            }) as ButtonInteraction;
            const profileId = userProfileToUpdate.customId;
            const selectedProfile = userProfiles.find(profile => profile.id === parseInt(profileId));
            const updateProfileModal = createProfileModal.generateProfileModal(selectedProfile);
            await interaction.showModal(updateProfileModal);
            // await userProfilesDao.deleteUserProfile(profileId);
            // await interaction.followUp({
            //     content: `The profile has been deleted.`,
            //     ephemeral: true,
            // });
            // await interaction?.deleteReply();
        } catch (err) {
            console.error(err);
            await interaction.deleteReply();
            await interaction.followUp({
                content: `There was an error updating your selected profile.`,
                ephemeral: true,
            });
        }  
    }
};

export = updateProfileCommand;