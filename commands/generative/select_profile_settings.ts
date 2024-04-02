import { SlashCommandBuilder, ChatInputCommandInteraction, CollectedInteraction, SlashCommandStringOption, ButtonInteraction } from "discord.js";
import { Command, optInCommands } from "../../shared/discord-js-types";
import userProfilesDao from "../../database/user_profiles/userProfilesDao";
import profilesService, { SELECT_CHAT_TIMEOUT_ID, SELECT_TEXT_MODEL_ID } from "../../openAIClient/profiles/profiles.service";

const selectProfileModelCommand: Command = {
    data: new SlashCommandBuilder()
        .setName(optInCommands.SELECT_PROFILE_SETTINGS)
        .setDescription(`Update you selected profile's settings`)
        .addStringOption((strOption: SlashCommandStringOption) =>
            strOption.setName('profile_setting')
            .setDescription('The profile setting you would like to update')
            .setRequired(true)
            .addChoices(
                { name: 'text model', value: SELECT_TEXT_MODEL_ID },
                { name: 'chat timeout', value: SELECT_CHAT_TIMEOUT_ID}
            )
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        const { user } = interaction;
        const profileSetting = await interaction.options.getString('profile_setting', true);
        const selectedProfile = await userProfilesDao.getSelectedProfile(user.id);
        if (!selectedProfile) {
            return interaction.reply({
                content: `:exclamation: You do not have any profile selected to update a model`,
                ephemeral: true,
            });
        }

        const settingsReply = profilesService.processSettingsDisplay(profileSetting, selectedProfile);
        const settingResponse = await interaction.reply({
            content: settingsReply?.displayMsg,
            components: [settingsReply?.row as any],
            ephemeral: true,
        });

        const collectorFilter = (message: CollectedInteraction) => { return message?.user?.id === interaction.user.id;};
        const userSettingChoice = await settingResponse.awaitMessageComponent({
            filter: collectorFilter,
            time: 120000,
        }).catch(() => {
            return settingResponse.edit({
                content: `Response timeout reached. No profile updates were applied`,
                components: [],
            });
        }) as ButtonInteraction;

        const settingVal = userSettingChoice.customId;
        if (!settingVal) {
            return;
        }
        await profilesService.processUpdateUserProfile(profileSetting, selectedProfile, settingVal);
        await settingResponse.edit({
            content: `Profile settings for **${selectedProfile.name}** were updated successfully!`,
            components: [],
        });

    },
};

export = selectProfileModelCommand;