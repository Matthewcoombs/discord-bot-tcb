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
            const { singleInstanceMessageCollector } = message.client;
            // const initMessage = message.content;
            const user = message.author;
            const isBot = user.bot;
            const setUserMsgCol = singleInstanceMessageCollector.get(user.id);
            
            if (!setUserMsgCol && !isBot) {
                const collector = message.channel.createMessageCollector() as MessageCollector;

                singleInstanceMessageCollector.set(
                    message.author.id, {
                        userId: user.id,
                    }
                );
        
                const userResponseTimeout = setTimeout(async () => { 
                    collector.stop();
                    await user.send(`Looks like you're no longer there ${user.username}. Our chat has ended.`);
                }, CHAT_GPT_CHAT_TIMEOUT);
                

                collector.on('collect', newMessage => {
                    userResponseTimeout.refresh();
                    const collected = Array.from(collector.collected.values());
                    if (!newMessage.author.bot) {
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
                });

                collector.on('end', collected => {
                    console.log('The DM chat has been terminated');
                    clearTimeout(userResponseTimeout);
                    collected.clear();
                    message.client.singleInstanceMessageCollector.clear();
                });
            }
        }
        return;
    },
};

export = directMessageEvent;