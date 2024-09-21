import { ChannelType, Events, Message, MessageCollector } from "discord.js";
import { Command } from "../shared/discord-js-types";
import { DEFAULT_CHAT_TIMEOUT, MAX_MESSAGE_COLLECTORS } from "../shared/constants";
import chatCompletionService, { CHAT_COMPLETION_SUPPORTED_IMAGE_TYPES, ChatCompletionMessage, JsonContent } from "../openAIClient/chatCompletion/chatCompletion.service";
import { OpenAi } from "..";
import { config } from "../config";
import userProfilesDao from "../database/user_profiles/userProfilesDao";
import { processBotResponseLength, validateJsonContent } from "../shared/utils";
import sendEmailService from "../emailClient/sendEmail/sendEmail.service";
import { ChatCompletion } from "openai/resources";

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

const directMessageEvent: Command = {
    name: Events.MessageCreate,
    async execute(message: Message) {
        const user = message.author;
        const isBot = user.bot;
        const { singleInstanceCommands, singleInstanceMessageCollector } = message.client;
        const setUserMsgCol = singleInstanceMessageCollector.get(user.id);
        const setUserSingleInstanceCommand = isBot ? undefined : singleInstanceCommands.find((cmd) => {
            return cmd.userId === user.id && cmd.channelId === message.channel.id;
        });
        const botMention = message.mentions.users.filter( usr => usr.id === config.botId);
        const isBotMentioned = botMention.size > 0;
        const isDirectMessage = message.channel.type === ChannelType.DM;

        if (isDirectMessage && !isBot && !setUserSingleInstanceCommand || isBotMentioned && !isBot && !setUserSingleInstanceCommand) {
            if (singleInstanceMessageCollector.size === MAX_MESSAGE_COLLECTORS) {
                return sendResponse(isDirectMessage, message, `The max amount of my chat instances has been reached.`);
            }

            try {
                if (setUserMsgCol && setUserMsgCol.channelId !== message.channel.id) {
                    await sendResponse(isDirectMessage, message, `Sorry you've already initiated a chat in another channel.`);
                }
                
                // Checking to see if the current user (non bot) has already initiated a direct message with the bot.
                // If the user has we will skip this process altogether.
                if (!setUserMsgCol) {
                    const selectedProfile = await userProfilesDao.getSelectedProfile(user.id);

                    const collectorFilter = (colMsg: Message) => 
                    // collect message if the message is coming from the user who initiated
                    colMsg.author.id === user.id || 
                    // collect message if its a response to a user from the bot from an initiated chat
                    colMsg.author.bot && colMsg.mentions.users.filter(usr => usr.id === user.id).size > 0 ||
                    // collect message if its a response to a user from the bot in a DM channel
                    isDirectMessage && colMsg.author.bot;
                    const collector = message.channel.createMessageCollector({
                        filter: collectorFilter,
                    }) as MessageCollector;

                    singleInstanceMessageCollector.set(
                        user.id, {
                            userId: user.id,
                            selectedProfile: selectedProfile,
                            channelId: message.channel.id,
                        }
                    );
                        
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
                            // filtering out all unsupported attachment file types from the user's most recent message.
                            const lastCollectedMsg = collected[collected.length - 1];
                            const { matched, unMatched, overMax } = lastCollectedMsg.attachments.reduce((acc, attachment) => {
                                if (CHAT_COMPLETION_SUPPORTED_IMAGE_TYPES.includes(attachment.contentType as string)) {
                                    acc.matched.length < 4 ? acc.matched.push(attachment) : acc.overMax.push(attachment.name);
                                } else {
                                    acc.unMatched.push(attachment.name);
                                }
                                return acc;
                            }, { matched: [] as any, unMatched: [] as string[], overMax: [] as string[]});
                            lastCollectedMsg.attachments = matched;
                            collected[collected.length - 1] = lastCollectedMsg;

                            const userMessageInstance = singleInstanceMessageCollector.get(user.id);
                            const chatCompletionMessages = chatCompletionService.formatChatCompletionMessages(collected, userMessageInstance?.selectedProfile);

                            // This logic is to check and ensure that generative response is valid JSON
                            let chatCompletion: ChatCompletion;
                            let jsonResponse: JsonContent = {
                                message: '',
                                endChat: false,
                                recipients: [],
                                emailSubject: '',
                                emailText: '',
                                emailPreview: false,
                                sendEmail: false,
                            };
                            let isValidJSON = false;
                            let retries = 0;
                            const maxRetries = 5;
                            const delay = 2000; // 2 seconds

                            while (!isValidJSON && retries < maxRetries) {
                                try {
                                    chatCompletion = await OpenAi.chat.completions.create({
                                        model: userMessageInstance?.selectedProfile ? userMessageInstance.selectedProfile.textModel : config.openAi.defaultChatCompletionModel,
                                        response_format: { type: 'json_object' },
                                        messages: chatCompletionMessages as any,
                                    });
                                    jsonResponse = JSON.parse(chatCompletion.choices[0].message.content as string);
                                    isValidJSON = validateJsonContent(jsonResponse);
                                    if (!isValidJSON) {
                                        console.log(`invalid JSON content returned for [user]: ${user.username} - on [retries]: ${retries + 1}`);
                                        await new Promise(resolve => setTimeout(resolve, delay));
                                        retries++;
                                    }
                                } catch (err) {
                                    console.error(`there was an error validating the returned for [user]: ${user.username} - on [retries]: ${retries + 1}`);
                                    await new Promise(resolve => setTimeout(resolve, delay));
                                        retries++;
                                }
                            }

                            if (retries === maxRetries) {
                                collector.stop();
                                await sendResponse(isDirectMessage, message, 'Sorry looks like something went wrong during the validation of my generative serices :disappointed_relieved:.');
                            }


                            const { message: response, emailSubject, emailText, recipients, sendEmail, endChat } = jsonResponse;
                            if (sendEmail) {
                                sendEmailService.sendEmail(user.username, recipients, emailText, emailSubject);
                                await sendResponse(isDirectMessage, message,
                                    `:incoming_envelope: Your email has been sent!` 
                                );
                            }
                            
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
                        message.client.singleInstanceMessageCollector.delete(user.id);
                    });

                    // Programmatically triggering the message collector to fire on the initial message or mention to the bot.
                    message.content = selectedProfile ?  message.content.replace(/<@\d+>/g, selectedProfile.name) : message.content;
                    collector.handleCollect(message);
                }
            } catch (err) {
                message.client.singleInstanceMessageCollector.delete(user.id);
                await sendResponse(isDirectMessage, message, 'Sorry looks like there was an issue. Our chat has ended.');
                console.error(err);
            }
        }
        return;
    },
};

export = directMessageEvent;