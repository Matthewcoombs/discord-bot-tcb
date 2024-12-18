import {
  ChannelType,
  Events,
  Message,
  MessageCollector,
  MessageCreateOptions,
  TextChannel,
} from 'discord.js';
import { collectorEndReason, Command } from '../shared/discord-js-types';
import {
  DEFAULT_CHAT_TIMEOUT,
  MAX_MESSAGE_COLLECTORS,
} from '../shared/constants';
import chatCompletionService, {
  CHAT_COMPLETION_SUPPORTED_IMAGE_TYPES,
} from '../openAIClient/chatCompletion/chatCompletion.service';
import { aiServiceEnums, chatToolsEnum, config } from '../config';
import userProfilesDao, {
  UserProfile,
} from '../database/user_profiles/userProfilesDao';
import {
  deleteTempFilesByTag,
  generateInteractionTag,
  processBotResponseLength,
} from '../shared/utils';
import openAIMessagesService from '../openAIClient/messages/openAIMessages.service';

async function sendResponse(
  isDM: boolean,
  message: Message,
  messageCreateOptions: MessageCreateOptions,
) {
  // Cleaning potentially injected user tags by openai
  const userTag = `<@${message.author.id}>`;
  messageCreateOptions?.content?.replace(/<@\d+>/g, '').trim();

  const responses = processBotResponseLength(
    messageCreateOptions?.content as string,
  );

  for (let i = 0; i < responses.length; i++) {
    if (messageCreateOptions.files && i !== responses.length - 1) {
      messageCreateOptions.files = [];
    }
    if (messageCreateOptions.embeds && i !== responses.length - 1) {
      messageCreateOptions.embeds = [];
    }

    if (isDM) {
      messageCreateOptions.content = responses[i];
      await message.author.send(messageCreateOptions);
    } else {
      messageCreateOptions.content = `${userTag} ${responses[i]}`;
      await message.channel.send(messageCreateOptions);
    }
  }
}

function filterAttachedFiles(message: Message<boolean>) {
  const { matched, unSupportedFileTypes, overMax } = message.attachments.reduce(
    (acc, attachment) => {
      if (
        CHAT_COMPLETION_SUPPORTED_IMAGE_TYPES.includes(
          attachment.contentType as string,
        )
      ) {
        acc.matched.length < 4
          ? acc.matched.push(attachment)
          : acc.overMax.push(attachment.name);
      } else {
        acc.unSupportedFileTypes.push(attachment.name);
      }
      return acc;
    },
    {
      matched: [] as any,
      unSupportedFileTypes: [] as string[],
      overMax: [] as string[],
    },
  );
  message.attachments = matched;
  return {
    message,
    unSupportedFileTypes,
    overMax,
  };
}

const directMessageEvent: Command = {
  name: Events.MessageCreate,
  async execute(message: Message) {
    const { singleInstanceCommands, chatInstanceCollector } = message.client;
    const { author: user, channel } = message;
    const { id: channelId, name: channelName } = channel as TextChannel;
    const { bot: isBot, id: userId } = user;
    const userChatInstance = chatInstanceCollector.get(userId);
    const isDirectMessage = message.channel.type === ChannelType.DM;
    const isBotMentioned =
      message.mentions.users.filter((usr) => usr.id === config.botId).size > 0;

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
      return sendResponse(isDirectMessage, message, {
        content: `The max amount of my chat instances has been reached.`,
      });
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
      chatInstanceCollector.set(userId, {
        userId,
        selectedProfile,
        channelId: channelId,
        channelName: channelName,
        isProcessing: false,
        interactionTag: generateInteractionTag(),
      });
    }
    try {
      const collectorFilter = (colMsg: Message) =>
        // collect message if the message is coming from the user who initiated
        colMsg.author.id === userId ||
        // collect message if its a response to a user from the bot from an initiated chat
        (colMsg.author.bot &&
          colMsg.mentions.users.filter((usr) => usr.id === userId).size > 0) ||
        // collect message if its a response to a user from the bot in a DM channel
        (isDirectMessage && colMsg.author.bot);
      const timeout =
        selectedProfile && selectedProfile.timeout
          ? Number(selectedProfile.timeout)
          : DEFAULT_CHAT_TIMEOUT;
      const collector = message.channel.createMessageCollector({
        filter: collectorFilter,
        idle: timeout,
      }) as MessageCollector;

      collector.on('collect', async (lastMsg) => {
        const collected = Array.from(collector.collected.values());
        // If the message is coming from the bot we return
        if (lastMsg.author.bot) {
          return;
        }

        // If the message received by the message collector is not from the bot, we proceed with the following logic.
        const userMessageInstance = chatInstanceCollector.get(userId);

        // If there is no se user message instance return
        if (!userMessageInstance) {
          return;
        }

        // if the previous collected message is still processing we return
        if (userMessageInstance?.isProcessing) {
          await sendResponse(isDirectMessage, message, {
            content: `Hold on I'm still processing your previous message :thought_balloon:...`,
          });
          return;
        }

        // filtering out all unsupported attachment file types from the user's most recent message.
        const {
          message: updatedLastMsg,
          unSupportedFileTypes,
          overMax,
        } = filterAttachedFiles(lastMsg);

        // If the user has provided an image file type the bot does not support we return
        if (unSupportedFileTypes.length > 0) {
          const unSupportedWarning = `:warning: Sorry, I currently do not support the file types for the following file(s): ${unSupportedFileTypes}\n
            Supported file types: ${CHAT_COMPLETION_SUPPORTED_IMAGE_TYPES}`;
          return await sendResponse(isDirectMessage, message, {
            content: unSupportedWarning,
          });
        }

        // If the user has provided image files over the maximum amount of supported image uploads we return
        if (overMax.length > 0) {
          const overMaxWarning = `:warning: Sorry, you've reached the maximum limit of attachments (4). You can send the following files again in another message: ${overMax}`;
          return await sendResponse(isDirectMessage, message, {
            content: overMaxWarning,
          });
        }

        /**
         * determine the message logic flow based on the ai service the user has
         * selected. If the user has not created a profile then the we will fall
         * back to the default system service.
         **/
        let finalResponse: MessageCreateOptions = {};
        let endChat: boolean = false;
        switch (userMessageInstance.selectedProfile.service) {
          case aiServiceEnums.ANTHROPIC: {
            break;
          }
          case aiServiceEnums.OPENAI: {
            break;
          }
          default: {
            break;
          }
        }

        collected[collected.length - 1] = updatedLastMsg;
        const chatCompletionMessages =
          chatCompletionService.formatChatCompletionMessages(
            collected,
            userMessageInstance?.selectedProfile,
          );

        userMessageInstance.isProcessing = true;
        chatInstanceCollector.set(userId, userMessageInstance);
        const { content, toolCalls } =
          await openAIMessagesService.processGenerativeResponse(
            userMessageInstance,
            chatCompletionMessages,
          );

        // This logic handles instances of tool calls during the message instance
        if (toolCalls && toolCalls.length > 0) {
          endChat = toolCalls[0].function.name === chatToolsEnum.END_CHAT;
          finalResponse = await openAIMessagesService.processToolCalls(
            user,
            toolCalls,
            userMessageInstance.interactionTag,
          );
        } else {
          finalResponse.content = content as string;
        }

        userMessageInstance.isProcessing = false;
        chatInstanceCollector.set(userId, userMessageInstance);

        await sendResponse(isDirectMessage, message, finalResponse);
        if (endChat) {
          collector.stop();
        }
      });
      collector.on('end', async (collected) => {
        const endReason = collector.endReason;
        switch (endReason) {
          case collectorEndReason.IDLE:
            await sendResponse(isDirectMessage, message, {
              content: `Looks like you're no longer there ${user.username}. Our chat has ended.`,
            });
            break;
          case collectorEndReason.USER:
            // eslint-disable-next-line no-case-declarations
            const userMessageInstance = chatInstanceCollector.get(userId);
            if (userMessageInstance) {
              deleteTempFilesByTag(userMessageInstance?.interactionTag);
            }
            if (selectedProfile && selectedProfile.retention) {
              const collectedMsgs = Array.from(collected.values());
              const retentionMsgs =
                chatCompletionService.formatChatCompletionMessages(
                  collectedMsgs,
                  selectedProfile,
                );
              const cleanRetentionMsgs =
                openAIMessagesService.cleanChatCompletionMsgs(retentionMsgs);
              selectedProfile.retentionData = cleanRetentionMsgs;
              await userProfilesDao.updateUserProfile(selectedProfile);
            }
            await sendResponse(isDirectMessage, message, {
              content: `The chat session has ended :wave:`,
            });
            break;
          default:
            break;
        }
        const terminationMsg = isDirectMessage
          ? `The DM chat has been terminated with ${user.username}`
          : `The channel chat has been terminated with ${user.username}`;
        const time = new Date();
        console.log(`${terminationMsg} - [time]: ${time.toLocaleString()}`);
        collected.clear();
        message.client.chatInstanceCollector.delete(user.id);
      });

      // Programmatically triggering the message collector to fire on the initial message or mention to the bot.
      message.content = selectedProfile
        ? message.content.replace(/<@\d+>/g, selectedProfile.name)
        : message.content;
      collector.handleCollect(message);
    } catch (err) {
      const userMessageInstance = chatInstanceCollector.get(userId);
      if (userMessageInstance) {
        deleteTempFilesByTag(userMessageInstance?.interactionTag);
      }
      message.client.chatInstanceCollector.delete(user.id);
      await sendResponse(isDirectMessage, message, {
        content: 'Sorry looks like there was an issue. Our chat has ended.',
      });
      console.error(err);
    }
  },
};

export = directMessageEvent;
