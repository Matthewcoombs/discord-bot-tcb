import { ChannelType, Events, Message, MessageCollector } from "discord.js";
import { Command } from "../shared/discord-js-types";
import { CHAT_GPT_CHAT_TIMEOUT } from "../shared/constants";
import chatCompletionService from "../openAIClient/chatCompletion/chatCompletion.service";
import { OpenAi } from "..";
import { config } from "../config";


const directMessageEvent: Command = {
    name: Events.MessageCreate,
    execute(message: Message) {

        if (message.channel.type === ChannelType.DM) {
            try {
                const endChatKey = 'goodbye';
                const { singleInstanceMessageCollector } = message.client;
                const user = message.author;
                const userId = user.id;
                const isBot = user.bot;
                const setUserMsgCol = singleInstanceMessageCollector.get(userId);
                
                // Checking to see if the current user (non bot) has already initiated a direct message with the bot.
                // If the user has we will skip this process altogether.
                if (!setUserMsgCol && !isBot) {
                    user.send(`Hello ${user.username} lets talk.\n To end this conversation simply tell me "**${endChatKey}**"`);
                    const collector = message.channel.createMessageCollector() as MessageCollector;
                    singleInstanceMessageCollector.set(
                        message.author.id, {
                            userId: userId,
                        }
                    );
            
                    const userResponseTimeout = setTimeout(async () => { 
                        collector.stop();
                        await user.send(`Looks like you're no longer there ${user.username}. Our chat has ended.`);
                    }, CHAT_GPT_CHAT_TIMEOUT);

                    collector.on('collect', newMessage => {
                        userResponseTimeout.refresh();
                        const collected = Array.from(collector.collected.values());

                        // If the message recieved by the message collector is not from the bot, we proceed with the following logic.
                        if (!newMessage.author.bot) {
                            // Formatting the collected message to match the chatCompletion format the openAI API expects.
                            const chatCompletionMessages = chatCompletionService.formatChatCompletionMessages(collected);
                            OpenAi.chat.completions.create({
                                model: config.openAi.chatCompletionModel,
                                messages: chatCompletionMessages,
                            }).then(async chatCompletion => {
                                const response = chatCompletion.choices[0].message;
                                await user.send(response.content as string);
                            }).catch(async err => {
                                console.error(err);
                                collector.stop();
                                await user.send('Sorry looks like something went wrong :disappointed_relieved:.');
                            });
                        }

                        if (newMessage.content.toLowerCase() === endChatKey) {
                            collector.stop();
                        }
                    });
                    collector.on('end', collected => {
                        console.log('The DM chat has been terminated');
                        clearTimeout(userResponseTimeout);
                        collected.clear();
                        message.client.singleInstanceMessageCollector.clear();
                    });
                }
            } catch (err) {
                message.client.singleInstanceMessageCollector.clear();
                message.author.send('Sorry looks like there was an issue. Our chat has ended.');
                console.error(err);
            }
        }
        return;
    },
};

export = directMessageEvent;