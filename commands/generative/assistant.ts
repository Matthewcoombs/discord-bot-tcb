import { SlashCommandBuilder, ChatInputCommandInteraction, MessageCollector, Message } from "discord.js";
import { Command, singleInstanceCommandsEnum } from "../../shared/discord-js-types";
import userProfilesDao from "../../database/user_profiles/userProfilesDao";
import { OpenAi } from "../..";
import { DEFAULT_CHAT_TIMEOUT, TEMP_FOLDER_PATH, generateAssistantIntroCopy, generateAssistantRunKey } from "../../shared/constants";
import assistantsService from "../../openAIClient/assistants/assistants.service";
import * as fs from 'fs';
import { createTempFile, deleteTempFilesByTag, generateInteractionTag, getRemoteFileBufferData, validateBotResponseLength } from "../../shared/utils";
import filesService from "../../openAIClient/files/files.service";

const assistantCommand: Command = {
    data: new SlashCommandBuilder()
        .setName(singleInstanceCommandsEnum.ASSISTANT)
        .setDescription('Speak to your personal assistant for support'),
    async execute(interaction: ChatInputCommandInteraction) {
        const interactionTag = generateInteractionTag();
        try {
            const { user } = interaction;
            const selectedProfile = await userProfilesDao.getSelectedProfile(user.id);
            if (!selectedProfile) {
                interaction.client.singleInstanceCommands.delete(interaction.id);
                return interaction.reply({
                    content: `:exclamation: You do not have any profile selected to use the assistant service at this time`,
                    ephemeral: true
                });
            }

            await interaction.reply({
                content: generateAssistantIntroCopy(selectedProfile.name, user.username),
            });
            const thread = await OpenAi.beta.threads.retrieve(selectedProfile.threadId);
            const collectorFilter = (colMsg: Message) => 
                // collect message if the message is coming from the user who initiated
                colMsg.author.id === user.id;
            const collector = interaction?.channel?.createMessageCollector({
                filter: collectorFilter,
            }) as MessageCollector;
            const timeout = selectedProfile.timeout ? Number(selectedProfile.timeout) : DEFAULT_CHAT_TIMEOUT;
            const userResponseTimeout = setTimeout(async () => { 
                collector.stop();
                await interaction.followUp(`Looks like you're no longer there ${interaction.user.username}. Our assistant session has ended.`);
            }, timeout);

            collector.on('collect', async (message) => {
                userResponseTimeout.refresh();
                const isFileAttached = message.attachments.size > 0;
                const isUserMsg = !message.author.bot && message.author.username === interaction.user.username;
                const startRun = message.content.toLowerCase() === generateAssistantRunKey(selectedProfile.name) && isUserMsg;
                const isTerminationMsg = message.content.toLowerCase() === 'goodbye' && isUserMsg;
                if (isTerminationMsg) {
                    await interaction.followUp({
                        content: `Goodbye.`
                    });
                    collector.stop(); 
                } else if (!startRun) {
                    // checking for attached files to process and upload
                    let fileIds: string[] = [];
                    if (isFileAttached) {
                        const asyncFileDataRetrievalList = message.attachments.map(attachment => {
                            return getRemoteFileBufferData(attachment.url);
                        });
    
                        const bufferDataList = await Promise.all(asyncFileDataRetrievalList);
                        const tempFilePaths: string[] = [];
                        for (let i = 0; i < bufferDataList.length; i++) {
                            const tempFileName = `${user.username}-assistant-${interactionTag}-${i+1}`;
                            const filePath = createTempFile(bufferDataList[i], tempFileName);
                            tempFilePaths.push(filePath);

                        }
    
                        const asyncOpenAiFileUpload = tempFilePaths.map(filePath => {
                            return filesService.uploadFile(filePath, 'assistants');
                        });
    
                        const fileObjects = await Promise.all(asyncOpenAiFileUpload);
                        fileIds = fileObjects.map(fileObject => fileObject.id);
                    }

                    const assistantMessage = assistantsService.generateAssistantMessage(message, fileIds);
                    await OpenAi.beta.threads.messages.create(
                        thread.id,
                        assistantMessage,

                    );
                } else if (startRun) {
                    console.log(`Run Starting - [interaction-tag]: ${interactionTag}`);
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
                        console.log(`checking [status]: ${status} - [retries]: ${retries}`);

                        if (status !== 'completed') {
                            const delay = Math.min(baseDelay * Math.pow(2, retries), maxDelay);
                            const delayToSeconds = delay/1000;
                            await interaction.followUp({
                                content: `Run in progress :timer: - I will update you in another ${delayToSeconds} seconds.`,
                                ephemeral: true,
                            });
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
                        const { botResponse, combinedFileIds } = assistantsService.processAssistantRunMessages(messages, run.id);

                        let botResponseFiles: string[] = [];
                        if (combinedFileIds.length > 0) {
                            await assistantsService.processAssistantRunFiles(combinedFileIds, user.username, interactionTag);
                            botResponseFiles = fs.readdirSync(TEMP_FOLDER_PATH);
                            botResponseFiles = botResponseFiles
                                                .filter(fileName => fileName.includes(user.username) && fileName.includes(interactionTag.toString()))
                                                .map(fileName => `${TEMP_FOLDER_PATH}/${fileName}`);
                        }

                        await interaction.followUp({
                            content: validateBotResponseLength(botResponse),
                            files: botResponseFiles,
                        });
                        deleteTempFilesByTag(interactionTag);
                    }
                }
            });

            collector.on('end', collected => {
                console.log(`The assistant has been terminated - [interactionTag]: ${interactionTag}`);
                deleteTempFilesByTag(interactionTag);
                clearTimeout(userResponseTimeout);
                collected.clear();
                interaction.client.singleInstanceCommands.delete(interaction.id);
            });

        } catch (error: any) {
            await interaction.deleteReply();
            deleteTempFilesByTag(interactionTag);
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