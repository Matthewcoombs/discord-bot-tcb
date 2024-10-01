/* eslint-disable */
import { ChannelType, Events, Message, MessageCollector, TextChannel, User } from "discord.js";
import { ChatInstance, Command } from "../shared/discord-js-types";
import { DEFAULT_CHAT_TIMEOUT, MAX_MESSAGE_COLLECTORS } from "../shared/constants";
import chatCompletionService, { CHAT_COMPLETION_SUPPORTED_IMAGE_TYPES, ChatCompletionMessage, chatCompletionStructuredResponse, JsonContent } from "../openAIClient/chatCompletion/chatCompletion.service";
import { OpenAi } from "..";
import { config } from "../config";
import userProfilesDao, { UserProfile } from "../database/user_profiles/userProfilesDao";
import { processBotResponseLength, validateJsonContent } from "../shared/utils";
import { zodResponseFormat } from "openai/helpers/zod";
import { ParsedChatCompletion } from "openai/resources/beta/chat/completions";

async function sendResponse(isDM: boolean, message: Message, response: string) {
    // Cleaning potentially injected user tags by openai
    const userTag = `<@${message.author.id}>`;
    response = response.replace(/<@\d+>/g, '').trim();

    const responses = processBotResponseLength(response);
    for (let i = 0; i < responses.length; i++) {
        if (isDM) {
            await message.author.send({
                content: responses[i],
                target: message.author,
            });
        } else {
            message.channel.send(`${userTag} ${responses[i]}`);
        }
    }
}

function cleanChatCompletionMsgs (chatCompMsgs: ChatCompletionMessage[]) {
    const cleanedMsgs = chatCompMsgs.reduce((acc, compMsg) => {
        if (compMsg.role !== 'system') {
            const type = compMsg.content[0].type;
            const text = compMsg.content[0].text as string;
            acc.push({ role: compMsg.role, content: [{
                type,
                text: text.replace(/<@\d+>/g, '').trim()
            }]});
        }
        return acc;
    }, [] as ChatCompletionMessage[]);
    return cleanedMsgs;
}

async function validateGenerativeResponse(
    user: User, 
    userMessageInstance: ChatInstance, 
    chatCompletionMessages: ChatCompletionMessage[] ) {
    // This logic is to check and ensure that the generative response is valid JSON
    let chatCompletion: ParsedChatCompletion<JsonContent>;
    let jsonResponse: JsonContent = {
        message: '',
        endChat: false,
    };

    let isValidJSON = false;
    let retries = 0;
    const maxRetries = 5;
    const delay = 2000; // 2 seconds

    while (!isValidJSON && retries < maxRetries) {
        try {
            chatCompletion = await OpenAi.beta.chat.completions.parse({
                model: userMessageInstance?.selectedProfile ? userMessageInstance.selectedProfile.textModel : config.openAi.defaultChatCompletionModel,
                response_format: zodResponseFormat(chatCompletionStructuredResponse, "structured_response"),
                messages: chatCompletionMessages as any,
            });

            jsonResponse = chatCompletion.choices[0].message.parsed as JsonContent;
            isValidJSON = validateJsonContent(jsonResponse);
            if (!isValidJSON) {
                console.log(`invalid JSON content returned for [user]: ${user.username} - on [retries]: ${retries + 1}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retries++;
            }
        } catch (err) {
            console.error(err);
            console.error(`there was an error validating the returned for [user]: ${user.username} - on [retries]: ${retries + 1}`);
            await new Promise(resolve => setTimeout(resolve, delay));
                retries++;
        }
    }
    return {isValidJSON, jsonResponse};
}

function filterAttachedFiles(message: Message<boolean>) {
    const { matched, unMatched, overMax } = message.attachments.reduce((acc, attachment) => {
        if (CHAT_COMPLETION_SUPPORTED_IMAGE_TYPES.includes(attachment.contentType as string)) {
            acc.matched.length < 4 ? acc.matched.push(attachment) : acc.overMax.push(attachment.name);
        } else {
            acc.unMatched.push(attachment.name);
        }
        return acc;
    }, { matched: [] as any, unMatched: [] as string[], overMax: [] as string[]});
    message.attachments = matched;
    return {message, unMatched, overMax};
}

const directMessageEvent: Command = {
    name: Events.MessageCreate,
    async execute(message: Message) {
        const { singleInstanceCommands, chatInstanceCollector } = message.client;
        const { author: user, channel } = message;
        const { id: channelId, name: channelName } = channel as TextChannel;
        const { bot: isBot, id: userId} = user;
        const userChatInstance = chatInstanceCollector.get(userId);
        const isDirectMessage = message.channel.type === ChannelType.DM;
        const isBotMentioned = message.mentions.users.filter( usr => usr.id === config.botId).size > 0;
        
        // If the message is not a direct message and the bot is not mentioned we return
        if (!isBotMentioned && !isDirectMessage) {
            return;
        }

        // If the message event is coming from the bot we return
        if (isBot) {
            return;
        }

        // if the maximum amount of chat instances has been reached for the server we return
        if (chatInstanceCollector.size === MAX_MESSAGE_COLLECTORS) {
            return sendResponse(isDirectMessage, message, `The max amount of my chat instances has been reached.`);
        }

        // if a single instance command has been initiated in the current channel we return
        const setUserSingleInstanceCommand = singleInstanceCommands.find((cmd) => {
            return cmd.userId === userId && cmd.channelId === channelId;
        });
        if (setUserSingleInstanceCommand) {
            return;
        }

        let selectedProfile: UserProfile;
        // If the user has already initiated a chat instance we return
        if (userChatInstance) {
            return;
        } else {
            selectedProfile = await userProfilesDao.getSelectedProfile(userId);
            chatInstanceCollector.set(
                userId, {
                    userId,
                    selectedProfile,
                    channelId: channelId,
                    channelName: channelName,
                    isProcessing: false,
                },
            );
        }

        try {
            const collectorFilter = (colMsg: Message) => 
            // collect message if the message is coming from the user who initiated
            colMsg.author.id === userId || 
            // collect message if its a response to a user from the bot from an initiated chat
            colMsg.author.bot && colMsg.mentions.users.filter(usr => usr.id === userId).size > 0 ||
            // collect message if its a response to a user from the bot in a DM channel
            isDirectMessage && colMsg.author.bot;
            const collector = message.channel.createMessageCollector({
                filter: collectorFilter,
            }) as MessageCollector;
            
            // Terminating the chat if the user has not responded within the timeout window
            const timeout = selectedProfile && selectedProfile.timeout ? Number(selectedProfile.timeout) : DEFAULT_CHAT_TIMEOUT;
            const userResponseTimeout = setTimeout(async () => { 
                collector.stop();
                await sendResponse(isDirectMessage, message, `Looks like you're no longer there ${user.username}. Our chat has ended.`);
            }, timeout);

            collector.on('collect', async newMessage => {
                userResponseTimeout.refresh();
                const collected = Array.from(collector.collected.values());

                // If the message recieved by the message collector is not from the bot, we proceed with the following logic.
                if (!newMessage.author.bot) {
                    const userMessageInstance = chatInstanceCollector.get(userId) as ChatInstance;
                    
                    // if the previous collected message is still processing we will return
                    if (userMessageInstance?.isProcessing) {
                        await sendResponse(
                            isDirectMessage, 
                            message, 
                            `Hold on I'm still processing your previous message :thought_balloon:...`);
                        return;
                    }
                    
                    // filtering out all unsupported attachment file types from the user's most recent message.
                    let lastCollectedMsg = collected[collected.length - 1];
                    const { message: filteredlastCollectedMsg, unMatched, overMax } = filterAttachedFiles(lastCollectedMsg);
                    collected[collected.length - 1] = filteredlastCollectedMsg;
                    const chatCompletionMessages = chatCompletionService.formatChatCompletionMessages(collected, userMessageInstance?.selectedProfile);

                    userMessageInstance.isProcessing = true;
                    chatInstanceCollector.set(
                        userId, userMessageInstance,
                    );
                    const { isValidJSON, jsonResponse } = await validateGenerativeResponse(user, userMessageInstance, chatCompletionMessages);

                    if (!isValidJSON) {
                        await sendResponse(isDirectMessage, message, `Sorry it looks like I'm having an issue formatting a proper response for you :disappointed_relieved:`);
                    }
                    
                    const { message: response, endChat } = jsonResponse;
                    if (unMatched.length > 0) {
                        await sendResponse(isDirectMessage, message, 
                            `:warning: Sorry, I currently do not support the file types for the following file(s):\n${unMatched}`
                        );
                    }

                    if (overMax.length > 0) {
                        await sendResponse(isDirectMessage, message,
                            `:warning: Sorry, you've reached the maximum limit of attachments (4). You can send the following files again in another message:\n${overMax}`
                        );
                    }

                    userMessageInstance.isProcessing = false;
                    chatInstanceCollector.set(
                        userId, userMessageInstance,
                    );

                    await sendResponse(isDirectMessage, message, response);
                    if (endChat) {
                        collector.stop();
                    }
                }
            });
            collector.on('end', async collected => {
                if (selectedProfile && selectedProfile.retention) {
                    const collectedMsgs = Array.from(collected.values());
                    const retentionMsgs = chatCompletionService.formatChatCompletionMessages(collectedMsgs, selectedProfile);
                    const cleanRetentionMsgs = cleanChatCompletionMsgs(retentionMsgs);
                    selectedProfile.retentionData = cleanRetentionMsgs;
                    await userProfilesDao.updateUserProfile(selectedProfile);
                }

                const terminationMsg = isDirectMessage ? 
                    `The DM chat has been terminated with ${user.username}` : 
                    `The channel chat has been terminated with ${user.username}`;
                console.log(terminationMsg);
                clearTimeout(userResponseTimeout);
                collected.clear();
                message.client.chatInstanceCollector.delete(user.id);
            });

            // Programmatically triggering the message collector to fire on the initial message or mention to the bot.
            message.content = selectedProfile ?  message.content.replace(/<@\d+>/g, selectedProfile.name) : message.content;
            collector.handleCollect(message);
        } catch (err) {
            message.client.chatInstanceCollector.delete(user.id);
            await sendResponse(isDirectMessage, message, 'Sorry looks like there was an issue. Our chat has ended.');
            console.error(err);
        }
    },
};

export = directMessageEvent;