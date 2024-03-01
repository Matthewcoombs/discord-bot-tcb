import { SlashCommandBuilder, ChatInputCommandInteraction, MessageCollector } from "discord.js";
import { Command, singleInstanceCommandsEnum } from "../../shared/discord-js-types";
import userProfilesDao, { UserProfile } from "../../database/user_profiles/userProfilesDao";
import { OpenAi } from "../..";
import { CHAT_GPT_CHAT_TIMEOUT, TEMP_FOLDER_PATH, generateAssistantIntroCopy, generateAssistantRunKey } from "../../shared/constants";
import assistantsService from "../../openAIClient/assistants/assistants.service";
import * as fs from 'fs';

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
            });

            const interactionTag = Math.floor(10000 + Math.random() * 90000);
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
                if (message.content.toLowerCase() === 'goodbye' && message.author.username === interaction.user.username) {
                    await interaction.followUp({
                        content: `Goodbye.`
                    });
                    collector.stop(); 
                } else if (isUserMsg && !startRun) {
                    const assistantMessage = assistantsService.generateAssistantMessage(message);
                    await OpenAi.beta.threads.messages.create(
                        thread.id,
                        assistantMessage
                    );
                } else if (startRun) {
                    console.log('run starting');
                    await interaction.followUp({
                        content: `Run starting :checkered_flag:`,
                        ephemeral: true,
                    });

                    const run = await OpenAi.beta.threads.runs.create(
                        thread.id,
                        {
                            assistant_id: selectedProfile.assistantId,
                            instructions: selectedProfile.profile,
                        }
                    );

                    let status;
                    let retries = 0;
                    const maxRetries = 10;
                    const baseDelay = 3000; // 3 seconds
                    const maxDelay = 120000; // 2 minutes 
                    while (status !== 'completed' && retries < maxRetries) {
                        userResponseTimeout.refresh();
                        status = await assistantsService.getAssistantRunStatus(thread.id, run.id);
                        console.log('checking status:', status);

                        if (status !== 'completed') {
                            const delay = Math.min(baseDelay * Math.pow(2, retries), maxDelay);
                            console.log(delay);
                            await new Promise(resolve => setTimeout(resolve, delay));
                            retries++;
                        }
                    }

                    if (status === 'completed') {
                        await interaction.followUp({
                            content: `Run complete :green_circle:`,
                            ephemeral: true,
                        });

                        const messages = await OpenAi.beta.threads.messages.list(
                            thread.id,
                        );
                        const botResponse = await assistantsService.processAssistantRunMessages(messages, interaction, interactionTag);                        
                        fs.readdir(TEMP_FOLDER_PATH, async (err, files) => {
                            if (err) {
                                console.error(`Error reading /temp directory:`, err);
                                collector.stop();
                            }

                            files = files
                                .filter(fileName => fileName.includes(user.username) && fileName.includes(interactionTag.toString()))
                                .map(fileName => `${TEMP_FOLDER_PATH}/${fileName}`);
                            console.log('files found:', files);

                            await interaction.followUp({
                                content: botResponse,
                                files,
                            });
                            
                        });
                    }
                }
            });

            collector.on('end', collected => {
                console.log('The assistant has been terminated');
                clearTimeout(userResponseTimeout);
                collected.clear();
                interaction.client.singleInstanceCommands.delete(interaction.id);
            });

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