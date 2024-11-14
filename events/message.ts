import {
  ChannelType,
  EmbedBuilder,
  Events,
  Message,
  MessageCollector,
  MessageCreateOptions,
  TextChannel,
  User,
} from 'discord.js';
import { ChatInstance, Command } from '../shared/discord-js-types';
import {
  DEFAULT_CHAT_TIMEOUT,
  MAX_MESSAGE_COLLECTORS,
} from '../shared/constants';
import chatCompletionService, {
  CHAT_COMPLETION_SUPPORTED_IMAGE_TYPES,
  ChatCompletionMessage,
  chatCompletionRoles,
  chatCompletionStructuredResponse,
  JsonContent,
} from '../openAIClient/chatCompletion/chatCompletion.service';
import { OpenAi } from '..';
import { chatToolsEnum, config, imageModelEnums } from '../config';
import userProfilesDao, {
  UserProfile,
} from '../database/user_profiles/userProfilesDao';
import {
  deleteTempFilesByTag,
  generateInteractionTag,
  processBotResponseLength,
} from '../shared/utils';
import { zodResponseFormat } from 'openai/helpers/zod';
import imagesService, {
  GenerateImageOptions,
} from '../openAIClient/images/images.service';
import { ParsedFunctionToolCall } from 'openai/resources/beta/chat/completions';

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

function cleanChatCompletionMsgs(chatCompMsgs: ChatCompletionMessage[]) {
  const cleanedMsgs = chatCompMsgs.reduce((acc, compMsg) => {
    if (
      compMsg.role !== chatCompletionRoles.SYSTEM &&
      compMsg.role !== chatCompletionRoles.TOOL &&
      compMsg.content
    ) {
      const type = compMsg.content[0].type;
      const text = compMsg.content[0].text as string;
      acc.push({
        role: compMsg.role,
        content: [
          {
            type,
            text: text.replace(/<@\d+>/g, '').trim(),
          },
        ],
      });
    } else {
      acc.push(compMsg);
    }
    return acc;
  }, [] as ChatCompletionMessage[]);
  return cleanedMsgs;
}

async function processGenerativeResponse(
  userMessageInstance: ChatInstance,
  chatCompletionMessages: ChatCompletionMessage[],
) {
  const chatCompletion = await OpenAi.beta.chat.completions.parse({
    model: userMessageInstance?.selectedProfile
      ? userMessageInstance.selectedProfile.textModel
      : config.openAi.defaultChatCompletionModel,
    response_format: zodResponseFormat(
      chatCompletionStructuredResponse,
      'structured_response',
    ),
    messages: chatCompletionMessages as any,
    /**
     Temporarily disabling message tool call logic until random tool calling is fixed
     **/
    // tools: config.functionTools as any,
  });

  const structuredResponse = chatCompletion.choices[0].message
    .parsed as JsonContent;
  const toolCalls = chatCompletion.choices[0].message.tool_calls;

  return { structuredResponse, toolCalls };
}

async function processToolCalls(
  user: User,
  toolCalls: ParsedFunctionToolCall[],
  interactionTag: number,
): Promise<MessageCreateOptions> {
  let toolResponse: MessageCreateOptions = {};
  const toolCall = toolCalls[0];
  const { id, type } = toolCall;
  const { name: toolName, parsed_arguments } = toolCall.function;

  const toolEmbed = new EmbedBuilder().setTitle(toolName).setFields([
    { name: 'id', value: id, inline: true },
    { name: 'type', value: type, inline: true },
    { name: 'arguments', value: toolCall.function.arguments, inline: true },
  ]);

  switch (toolName) {
    case chatToolsEnum.GENERATE_IMAGE: {
      const imageGenerateOptions = {
        ...(parsed_arguments as GenerateImageOptions),
        model: imageModelEnums.DALLE3,
      };
      imageGenerateOptions.count = Number(imageGenerateOptions.count);
      const imageFiles = await imagesService.generateImages(
        user,
        imageGenerateOptions,
        interactionTag,
      );
      toolResponse = {
        content:
          imageFiles.length > 1
            ? `Here are your requested images ${user.username} :blush:`
            : `Here is your requested image ${user.username} :blush:`,
        files: imageFiles,
        embeds: [toolEmbed],
      };
      break;
    }
    default:
      break;
  }
  return toolResponse;
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
      const collector = message.channel.createMessageCollector({
        filter: collectorFilter,
      }) as MessageCollector;

      // Terminating the chat if the user has not responded within the timeout window
      const timeout =
        selectedProfile && selectedProfile.timeout
          ? Number(selectedProfile.timeout)
          : DEFAULT_CHAT_TIMEOUT;
      const userResponseTimeout = setTimeout(async () => {
        collector.stop();
        await sendResponse(isDirectMessage, message, {
          content: `Looks like you're no longer there ${user.username}. Our chat has ended.`,
        });
      }, timeout);

      collector.on('collect', async (lastMsg) => {
        userResponseTimeout.refresh();
        const collected = Array.from(collector.collected.values());
        // If the message is coming from the bot we return
        if (lastMsg.author.bot) {
          return;
        }

        // If the message recieved by the message collector is not from the bot, we proceed with the following logic.
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

        collected[collected.length - 1] = updatedLastMsg;
        const chatCompletionMessages =
          chatCompletionService.formatChatCompletionMessages(
            collected,
            userMessageInstance?.selectedProfile,
          );

        let finalResponse: MessageCreateOptions = {};
        let endChat: boolean = false;
        userMessageInstance.isProcessing = true;
        chatInstanceCollector.set(userId, userMessageInstance);
        const { structuredResponse, toolCalls } =
          await processGenerativeResponse(
            userMessageInstance,
            chatCompletionMessages,
          );

        // This logic handles instances of tool calls during the message instance
        if (toolCalls && toolCalls.length > 0) {
          finalResponse = await processToolCalls(
            user,
            toolCalls,
            userMessageInstance.interactionTag,
          );
        } else {
          finalResponse.content = structuredResponse.message;
          endChat = structuredResponse.endChat;
        }

        userMessageInstance.isProcessing = false;
        chatInstanceCollector.set(userId, userMessageInstance);

        await sendResponse(isDirectMessage, message, finalResponse);
        if (endChat) {
          collector.stop();
        }
      });
      collector.on('end', async (collected) => {
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
          const cleanRetentionMsgs = cleanChatCompletionMsgs(retentionMsgs);
          selectedProfile.retentionData = cleanRetentionMsgs;
          await userProfilesDao.updateUserProfile(selectedProfile);
        }

        const terminationMsg = isDirectMessage
          ? `The DM chat has been terminated with ${user.username}`
          : `The channel chat has been terminated with ${user.username}`;
        console.log(terminationMsg);
        clearTimeout(userResponseTimeout);
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
