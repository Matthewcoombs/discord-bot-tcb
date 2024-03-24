import { SlashCommandBuilder, SlashCommandStringOption, ChatInputCommandInteraction } from "discord.js";
import { Command, optInCommands } from "../../shared/discord-js-types";
import { textBasedModelEnums } from "../../config";
import userProfilesDao from "../../database/user_profiles/userProfilesDao";
import { OpenAi } from "../..";


const selectProfileModelCommand: Command = {
    data: new SlashCommandBuilder()
        .setName(optInCommands.SELECT_PROFILE_MODEL)
        .setDescription('Select the models used by your profile')
        .addStringOption((strOptions: SlashCommandStringOption) => 
            strOptions.setName('chat_model')
            .setDescription('The model your profile will use in chat services')
            .setRequired(true)
            .addChoices(
                {name: textBasedModelEnums.GPT3, value: textBasedModelEnums.GPT3},
                {name: textBasedModelEnums.GPT4, value: textBasedModelEnums.GPT4},
            )
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        const { user } = interaction;
        const chatModel = interaction.options.getString('chat_model', true);
        const selectedProfile = await userProfilesDao.getSelectedProfile(user.id);
        if (!selectedProfile) {
            return interaction.reply({
                content: `:exclamation: You do not have any profile selected to update a model`,
                ephemeral: true,
            });
        }

        selectedProfile.textModel = chatModel;
        await OpenAi.beta.assistants.update(selectedProfile.assistantId, {
            model: selectedProfile.textModel,
        });
        // NOTE - apply pg transaction in the future for potential errors
        await userProfilesDao.updateUserProfile(selectedProfile);
        await interaction.reply(`The text based model for **${selectedProfile.name}** was updated successfully!`);

    },
};

export = selectProfileModelCommand;