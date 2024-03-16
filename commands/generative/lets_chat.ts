import { ChannelType, ChatInputCommandInteraction, CollectedInteraction, InteractionResponse, MessageCollector, SlashCommandBuilder } from "discord.js";
import { Command, singleInstanceCommandsEnum } from "../../shared/discord-js-types";
import { OpenAi } from "../..";
import { config } from "../../config";
import chatCompletionService from "../../openAIClient/chatCompletion/chatCompletion.service";
import { CHAT_GPT_CHAT_TIMEOUT } from "../../shared/constants";
import usersDao from "../../database/users/usersDao";
import userProfilesDao, { UserProfile } from "../../database/user_profiles/userProfilesDao";
import { InteractionTimeOutError, USER_TIMEOUT_CODE } from "../../shared/errors";
import { validateBotResponseLength } from "../../shared/utils";

async function sendInitResponse(interaction: ChatInputCommandInteraction) {
    const { user, channel } = interaction;
    const channelType = channel?.type;
    const isDirectMessage = channelType === ChannelType.DM;
    let initialResponse = isDirectMessage ? 
    `Hi ${interaction?.user?.username}! This is just between me and you, so you can share all your dirty little secrets :smirk:.\n` :
    `Hi there, ${user?.username} initiated a chat :wave:! Lets Chat!\n`;
    initialResponse = initialResponse + `To end this conversation simply tell me "**goodbye**"`;
    const initMessage = await interaction.reply({
        content: initialResponse,
        ephemeral: true,
    });
    return initMessage;
}

async function initUserProfile(interaction: ChatInputCommandInteraction, initMessage:InteractionResponse , userProfiles: UserProfile[]) {
    const { content: initialMessage } = await initMessage.fetch();
    
    const actionRowComponent = chatCompletionService.generateUserProfileDisplay(userProfiles);
    const profileSelectResponse = await initMessage.edit({
        content: `${initialMessage}\nPlease select who you would like to speak to :performing_arts::`,
        components: [actionRowComponent as any],
    });
    const collectorFilter = (message: CollectedInteraction) => { return message?.user?.id === interaction.user.id;};
    // If the user does not respond in 1 minutes (60000) the message is deleted.
    const userProfileChoice = await profileSelectResponse?.awaitMessageComponent({
        filter: collectorFilter,
        time: 60000,
    }).catch(() => {
        initMessage.delete();
        throw new InteractionTimeOutError({
            error:  `Interaction timeout reached`,
        });
    });


    const profileId = userProfileChoice?.customId as string;
    const selectedProfile = await userProfilesDao.getUserProfileById(profileId);
    await interaction.followUp({
        content: `${selectedProfile.name} selected`,
        ephemeral: true,
    });

    await initMessage.edit({
        components: [],
    });  

    return selectedProfile;
}

const letsChatCommand: Command = {
    data: new SlashCommandBuilder()
        .setName(singleInstanceCommandsEnum.LETS_CHAT)
        .setDescription('Talk to me!'),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            let userProfiles: UserProfile[] = [];
            const initMessage = await sendInitResponse(interaction);
            const { optIn } = await usersDao.getUserOptIn(interaction.user.id);
            if (optIn) {
                userProfiles = await userProfilesDao.getUserProfiles(interaction.user.id);
            }
            const isUserOptedInWithProfiles = optIn && userProfiles.length > 0;

            let selectedProfile: UserProfile;
            if (isUserOptedInWithProfiles) {
                selectedProfile = await initUserProfile(interaction, initMessage, userProfiles);
            }

            const collector = interaction?.channel?.createMessageCollector() as MessageCollector;

            const userResponseTimeout = setTimeout(async () => { 
                collector.stop();
                await interaction.followUp(`Looks like you're no longer there ${interaction.user.username}. Our chat has ended :disappointed:.`);

            }, CHAT_GPT_CHAT_TIMEOUT);

            collector?.on('collect', message => {
                userResponseTimeout.refresh();
                const collected = Array.from(collector.collected.values());
                if (message.author.bot === false && message.author.username === interaction.user.username) {
                    const chatCompletionMessages = chatCompletionService.formatChatCompletionMessages(collected, selectedProfile?.profile);

                    OpenAi.chat.completions.create({
                        model: selectedProfile ? selectedProfile.textModel : config.openAi.defaultChatCompletionModel,
                        messages: chatCompletionMessages,
                    }).then(async chatCompletion => {
                        const response = chatCompletion.choices[0].message;
                        await interaction.followUp(validateBotResponseLength(response?.content as string));
                    }).catch(async err => {
                        console.error(err);
                        collector.stop();
                        await interaction.followUp('Sorry looks like something went wrong in my head :disappointed_relieved:.');
                    });
                }

                if (message.content.toLowerCase() === 'goodbye' && message.author.username === interaction.user.username) {
                    collector.stop();
                }
            });

            collector.on('end', collected => {
                console.log('The chat has been terminated');
                clearTimeout(userResponseTimeout);
                collected.clear();
                interaction.client.singleInstanceCommands.delete(interaction.id);
            });
        } catch (err: any) {
            const errorMessage = err?.errorData?.code === USER_TIMEOUT_CODE ? 
                err.errorData.error : `Sorry there was an error running my chat service!`;
            await interaction.followUp({
                content: errorMessage,
                ephemeral: true,
            });
            interaction.client.singleInstanceCommands.delete(interaction.id);
        }
        
    }
};

export = letsChatCommand;