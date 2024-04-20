import { ChatInputCommandInteraction, CollectedInteraction, MessageCollector, SlashCommandBuilder, Message } from "discord.js";
import { Command, singleInstanceCommandsEnum } from "../../shared/discord-js-types";
import { OpenAi } from "../..";
import { config } from "../../config";
import chatCompletionService, { ChatCompletionMessage } from "../../openAIClient/chatCompletion/chatCompletion.service";
import { DEFAULT_CHAT_TIMEOUT } from "../../shared/constants";
import userProfilesDao, { UserProfile } from "../../database/user_profiles/userProfilesDao";
import { InteractionTimeOutError, USER_TIMEOUT_CODE } from "../../shared/errors";
import { generateInteractionTag, validateBotResponseLength } from "../../shared/utils";

async function sendReponse(interaction: ChatInputCommandInteraction, interactionTag: number, response: string, ephemeral: boolean) {
    // Cleaning potentially injected interaction tags by openai
    response = response.replace(/\*\*lets_chat-\d+\*\*:/g, '').trim();
    const taggedResponse = `**${singleInstanceCommandsEnum.LETS_CHAT}-${interactionTag}**: ${response}`;
    await interaction.followUp({
        content: taggedResponse,
        ephemeral,
    });
}

function cleanChatCompletionMsgs (chatCompMsgs: ChatCompletionMessage[]) {
    const cleanedMsgs = chatCompMsgs.reduce((acc, compMsg) => {
        if (compMsg.role !== 'system') {
            acc.push({ role: compMsg.role, content: compMsg.content.replace(/\*\*lets_chat-\d+\*\*:/g, '').trim()});
        }
        return acc;
    }, [] as ChatCompletionMessage[]);
    return cleanedMsgs;
}

const letsChatCommand: Command = {
    data: new SlashCommandBuilder()
        .setName(singleInstanceCommandsEnum.LETS_CHAT)
        .setDescription('Talk to me!'),
    async execute(interaction: ChatInputCommandInteraction) {
        const interactionTag = generateInteractionTag();
        const endChatKey = 'goodbye';
        const { user } = interaction;
        const initMsg = `Hi ${user.username}! You've initiated a chat between me and you. 
        To end this chat simply tell me **${endChatKey}**`;
        const initMsgResponse = await interaction.reply({
            content: initMsg,
            ephemeral: true,
        });

        const userProfiles = await userProfilesDao.getUserProfiles(user.id);
        let selectedProfile: UserProfile | null = null;
        if (userProfiles.length> 0) {
            // selectedProfile = await initUserProfile(interaction, initMessage, userProfiles, interactionTag);
            const { content: initContent } = await initMsgResponse.fetch();
            const actionRowComponent = chatCompletionService.generateUserProfileDisplay(userProfiles);
            const profileSelectResponse = await initMsgResponse.edit({
                content: `${initContent}\nPlease select which profile you would like to speak to :performing_arts::`,
                components: [actionRowComponent as any],
            });
            const collectorFilter = (message: CollectedInteraction) => { return message?.user?.id === interaction.user.id;};
            // If the user does not respond in 1 minutes (60000) the message is deleted.
            const userProfileChoice = await profileSelectResponse?.awaitMessageComponent({
                filter: collectorFilter,
                time: 60000,
            }).catch(() => {
                initMsgResponse.delete();
                throw new InteractionTimeOutError({
                    error:  `Interaction timeout reached`,
                });
            });

            const profileId = userProfileChoice?.customId as string;
            selectedProfile = await userProfilesDao.getUserProfileById(profileId);
            await sendReponse(interaction, interactionTag, `${selectedProfile.name} selected`, true);

            await initMsgResponse.edit({
                components: [],
            });  
        }

        try {
            const collectorFilter = (colMsg: Message) => 
                // collect message if the message is coming from the user who initiated
                colMsg.author.id === user.id || 
                // collect message if its a response to a user from the bot from an initiated chat
                colMsg.author.bot && colMsg.content.includes(interactionTag.toString());
                
            const collector = interaction?.channel?.createMessageCollector({
                filter: collectorFilter,
            }) as MessageCollector;

            const timeout = selectedProfile && selectedProfile.timeout ? Number(selectedProfile.timeout) : DEFAULT_CHAT_TIMEOUT;
            const userResponseTimeout = setTimeout(async () => { 
                collector.stop();
                await sendReponse(
                    interaction, 
                    interactionTag,
                    `Looks like you're no longer there ${user.username}. Our chat has ended :disappointed:.`,
                    false
                    );

            }, timeout);

            collector?.on('collect', message => {
                userResponseTimeout.refresh();
                const collected = Array.from(collector.collected.values());
                if (message.author.bot === false && message.author.username === user.username) {
                    const chatCompletionMessages = chatCompletionService.formatChatCompletionMessages(collected, selectedProfile as UserProfile);

                    OpenAi.chat.completions.create({
                        model: selectedProfile ? selectedProfile.textModel : config.openAi.defaultChatCompletionModel,
                        messages: chatCompletionMessages,
                    }).then(async chatCompletion => {
                        const response = chatCompletion.choices[0].message;
                        await sendReponse(interaction, interactionTag, validateBotResponseLength(response.content as string), false);
                        if (message.content.toLowerCase() === endChatKey && message.author.username === user.username) {
                            collector.stop();
                        }
                    }).catch(async err => {
                        console.error(err);
                        collector.stop();
                        await sendReponse(
                            interaction,
                            interactionTag,
                            'Sorry looks like something went wrong in my head :disappointed_relieved:.',
                            false
                        );
                    });
                }
            });

            collector.on('end', async collected => {
                if (selectedProfile?.retention) {
                    const collectedMsgs = Array.from(collected.values());
                    const retentionMsgs = chatCompletionService.formatChatCompletionMessages(collectedMsgs, selectedProfile);
                    const cleanRetentionMsgs = cleanChatCompletionMsgs(retentionMsgs);
                    selectedProfile.retentionData = cleanRetentionMsgs;
                    await userProfilesDao.updateUserProfile(selectedProfile);
                }
                console.log(`The chat has been terminated - [interactionTag]: ${interactionTag}`);
                clearTimeout(userResponseTimeout);
                collected.clear();
                interaction.client.singleInstanceCommands.delete(interaction.id);
            });
        } catch (err: any) {
            const errorMessage = err?.errorData?.code === USER_TIMEOUT_CODE ? 
                err.errorData.error : `Sorry there was an error running my chat service!`;
            await sendReponse(interaction, interactionTag, errorMessage, true);
            interaction.client.singleInstanceCommands.delete(interaction.id);
        }
        
    }
};

export = letsChatCommand;