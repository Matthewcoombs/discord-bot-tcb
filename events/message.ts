import { ChannelType, Events, Message, MessageCollector } from "discord.js";
import { Command } from "../shared/discord-js-types";
import { CHAT_GPT_CHAT_TIMEOUT, MAX_MESSAGE_COLLECTORS } from "../shared/constants";
import chatCompletionService from "../openAIClient/chatCompletion/chatCompletion.service";
import { OpenAi } from "..";
import { config } from "../config";
import userProfilesDao from "../database/user_profiles/userProfilesDao";

async function sendResponse(isDM: boolean, message: Message, response: string) {
    // Cleaning potentially injected user tags by openai
    const userTag = `<@${message.author.id}>`;
    response = response.replace(/<@\d+>/g, '').trim();

    if (isDM) {
        await message.author.send({
            content: response,
            target: message.author,
        });
    } else {
        message.channel.send(`${userTag} ${response}`);
    }
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
                const endChatKey = 'goodbye';

                if (setUserMsgCol && setUserMsgCol.channelId !== message.channel.id) {
                    await sendResponse(isDirectMessage, message, `Sorry you've already initiated a chat in another channel.`);
                }
                
                // Checking to see if the current user (non bot) has already initiated a direct message with the bot.
                // If the user has we will skip this process altogether.
                if (!setUserMsgCol) {
                    const selectedProfile = await userProfilesDao.getSelectedProfile(user.id);
                    await sendResponse(isDirectMessage, message, `You've initiated a chat session To end this session simply tell me "**${endChatKey}**."`);

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
            
                    const userResponseTimeout = setTimeout(async () => { 
                        collector.stop();
                        await sendResponse(isDirectMessage, message, `Looks like you're no longer there ${user.username}. Our chat has ended.`);
                    }, CHAT_GPT_CHAT_TIMEOUT);

                    collector.on('collect', newMessage => {
                        userResponseTimeout.refresh();
                        const collected = Array.from(collector.collected.values());

                        // If the message recieved by the message collector is not from the bot, we proceed with the following logic.
                        if (!newMessage.author.bot) {
                            // Formatting the collected message to match the chatCompletion format the openAI API expects.
                            const userMessageInstance = singleInstanceMessageCollector.get(user.id);
                            const chatCompletionMessages = chatCompletionService.formatChatCompletionMessages(collected, userMessageInstance?.selectedProfile?.profile);
                            OpenAi.chat.completions.create({
                                model: userMessageInstance?.selectedProfile ? userMessageInstance.selectedProfile.textModel : config.openAi.defaultChatCompletionModel,
                                messages: chatCompletionMessages,
                            }).then(async chatCompletion => {
                                const response = chatCompletion.choices[0].message;
                                await sendResponse(isDirectMessage, message, response.content as string);
                            }).catch(async err => {
                                console.error(err);
                                collector.stop();
                                await sendResponse(isDirectMessage, message, 'Sorry looks like something went wrong :disappointed_relieved:.');
                            });
                        }

                        if (newMessage.content.toLowerCase() === endChatKey) {
                            collector.stop();
                        }
                    });
                    collector.on('end', collected => {
                        const terminationMsg = isDirectMessage ? 'The DM chat has been terminated' : 'The channel chat has been terminated';
                        console.log(terminationMsg);
                        clearTimeout(userResponseTimeout);
                        collected.clear();
                        message.client.singleInstanceMessageCollector.delete(user.id);
                    });

                    // Programmatically triggering the message collector to fire on the initial message or mention to the bot.
                    message.content = selectedProfile ?  message.content.replace(/<@\d+>/g, selectedProfile.name) : message.content;
                    collector.collected.set(user.id, message);
                    collector.emit('collect', {
                        author: user , content: ''} as any
                    );
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