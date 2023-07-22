import { ChannelType, ChatInputCommandInteraction, MessageCollector, SlashCommandBuilder } from "discord.js";
import { Command } from "../../shared/discord-js-types";
import { OpenAi } from "../..";
import { config } from "../../config";
import chatCompletionService from "../../openAIClient/chatCompletion/chatCompletion.service";


const letsChatCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('lets_chat')
        .setDescription('Talk to me!'),
    async execute(interaction: ChatInputCommandInteraction) {
        const { user, channel } = interaction;
        const channelType = channel?.type;
        const isDirectMessage = channelType === ChannelType.DM;
        const initialResponse = isDirectMessage ? 
        `Hi ${user.username}! This is just between me and you, so you can share all your dirty little secrets :smirk:.` :
        `Hi there, ${user.username} initiated a chat :wave:! Lets Chat!`;

        await interaction.reply(initialResponse);
        await interaction.followUp('To end this conversation simply tell me "**goodbye**"');
            const collector = channel?.createMessageCollector() as MessageCollector;
            collector?.on('collect', message => {
            const collected = Array.from(collector.collected.values());

            if (message.author.bot === false) {
                const chatCompletionMessages = chatCompletionService.formatChatCompletionMessages(collected);
                OpenAi.createChatCompletion({
                    model: config.openAi.chatCompletionModel,
                    messages: chatCompletionMessages,
                }).then(async chatCompletion => {
                    const response = chatCompletion.data.choices[0].message;
                    await interaction.followUp(response?.content as string);
                }).catch(async err => {
                    console.error(err);
                    collector.stop();
                    await interaction.followUp('Sorry looks like something went wrong in my head :disappointed_relieved:.');

                })
            }

            if (message.content === 'goodbye' && message.author.username === user.username) {
                collector.stop();
            }
            });

            collector.on('end', collected => {
                console.log('The chat has been terminated');
                collected.clear();
                interaction.client.singleInstanceCommands.clear();
        })
    }
}

export = letsChatCommand;