import { SlashCommandBuilder, ChatInputCommandInteraction, MessageCollector } from "discord.js";
import { Command, singleInstanceCommandsEnum } from "../../shared/discord-js-types";
import userProfilesDao, { UserProfile } from "../../database/user_profiles/userProfilesDao";
import { OpenAi } from "../..";
import { CHAT_GPT_CHAT_TIMEOUT, generateAssistantIntroCopy, generateAssistantRunKey } from "../../shared/constants";
import assistantsService from "../../openAIClient/assistants/assistants.service";


const assistantCommand: Command = {
    data: new SlashCommandBuilder()
        .setName(singleInstanceCommandsEnum.ASSISTANT)
        .setDescription('Speak to your personal assistant for support'),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const { user } = interaction;
            let userProfiles: UserProfile[] = [];
            userProfiles = await userProfilesDao.getUserProfiles(user.id);
            const selectedProfile = userProfiles.find(profile => profile.selected);
            if (!selectedProfile) {
                return interaction.reply({
                    content: `You do not have any profile selected to use the assistant service at this time`,
                    ephemeral: true
                });
            }

            await interaction.reply({
                content: generateAssistantIntroCopy(selectedProfile.name, user.username),
                ephemeral: true,
            });


            const thread = await OpenAi.beta.threads.create();
            const collector = interaction?.channel?.createMessageCollector() as MessageCollector;
            const userResponseTimeout = setTimeout(async () => { 
                collector.stop();
                await interaction.followUp(`Looks like you're no longer there ${interaction.user.username}. Our assistant session has ended.`);
            }, CHAT_GPT_CHAT_TIMEOUT);

            collector.on('collect', async (message) => {
                userResponseTimeout.refresh();
                const startRun = message.content.toLowerCase() === generateAssistantRunKey(selectedProfile.name);
                const isUserMsg = !message.author.bot && message.author.username === interaction.user.username;
                if (isUserMsg && !startRun) {
                    const assistantMessage = assistantsService.generateAssistantMessage(message);
                    await OpenAi.beta.threads.messages.create(
                        thread.id,
                        assistantMessage
                    );
                } else if (startRun) {
                    const run = await OpenAi.beta.threads.runs.create(
                        thread.id,
                        {
                            assistant_id: selectedProfile.assistantId,
                            instructions: selectedProfile.profile,
                        }
                    );

                    const intervalId = setInterval(async () => {
                        const status = await assistantsService.getAssistantRunStatus(thread.id, run.id);
                        if (status === 'completed') {
                            const messages = await OpenAi.beta.threads.messages.list(
                                thread.id,
                            );
                            const botResponse = messages.data.reduce(msg => {
                                return `${msg}\n`;
                            }, '');
                            await interaction.followUp({
                                content: botResponse,
                            });
                            clearInterval(intervalId);
                        }
                    });
                }
            });

            // await interaction.deleteReply();
            // return interaction.followUp(`Dummy Response for testing`);

        } catch (error: any) {
            await interaction.deleteReply();
            const errorMessage = `Sorry there was an error in the assistant service.`;
            await interaction.followUp({
                content: errorMessage,
                ephemeral: true,
            });
            interaction.client.singleInstanceCommands.delete(interaction.id);
        }
    }
};

export = assistantCommand;