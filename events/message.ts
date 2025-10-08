import {
  Attachment,
  ChannelType,
  Collection,
  Events,
  Message,
  MessageCollector,
  MessageCreateOptions,
  TextChannel,
  User,
} from 'discord.js';
import { ChatInstance, collectorEndReason, Command } from '../shared/discord-js-types';
import chatCompletionService, {
  CHAT_COMPLETION_SUPPORTED_IMAGE_TYPES,
} from '../openAIClient/chatCompletion/chatCompletion.service';
import { aiServiceEnums, openaiToolsEnum, config, anthropicToolsEnum } from '../config';
import userProfilesDao, { UserProfile } from '../database/user_profiles/userProfilesDao';
import {
  deleteTempFilesByTag,
  generateInteractionTag,
  processBotResponseLength,
} from '../shared/utils';
import { INVALID_FILE_TYPE_CODE, TOO_MANY_ATTACHMENTS_CODE } from '../shared/errors';
import messageService from '../anthropicClient/messages/message.service';

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function createSpinner(message: Message, isDM: boolean) {
  let frameIndex = 0;
  let spinnerMessage: Message;
  let interval: NodeJS.Timeout;

  const startSpinner = async () => {
    const content = isDM
      ? spinnerFrames[frameIndex]
      : `<@${message.author.id}> ${spinnerFrames[frameIndex]}`;

    spinnerMessage = isDM ? await message.author.send(content) : await message.reply(content);

    interval = setInterval(async () => {
      frameIndex = (frameIndex + 1) % spinnerFrames.length;
      const newContent = isDM
        ? spinnerFrames[frameIndex]
        : `<@${message.author.id}> ${spinnerFrames[frameIndex]}`;

      try {
        await spinnerMessage.edit(newContent);
      } catch (error) {
        console.error('[ERROR] - There was an error handling the loading spinner', error);
        clearInterval(interval);
      }
    }, 1000);
  };

  return {
    start: startSpinner,
    stop: () => {
      if (interval) clearInterval(interval);
      return spinnerMessage;
    },
  };
}

async function sendResponse(
  isDM: boolean,
  message: Message,
  messageCreateOptions: MessageCreateOptions,
) {
  try {
    // Cleaning potentially injected user tags by openai
    const userTag = `<@${message.author.id}>`;
    messageCreateOptions?.content?.replace(/<@\d+>/g, '').trim();

    const responses = processBotResponseLength(messageCreateOptions?.content as string);

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
        await message.reply(messageCreateOptions);
      }
    }
  } catch (error) {
    console.error('[Error] Failed to send response:', error);
    // Fallback: try to send a simple error message
    try {
      const fallbackMessage = 'Sorry, I encountered an error while responding.';
      if (isDM) {
        await message.author.send(fallbackMessage);
      } else {
        await message.reply(fallbackMessage);
      }
    } catch (fallbackError) {
      console.error('[Error] Failed to send fallback message:', fallbackError);
    }
  }
}

function processAttachedFiles(message: Message<boolean>) {
  const errorRestrictions: {
    code: string;
    reason: string;
  }[] = [];

  if (message.attachments.size === 0) {
    return errorRestrictions;
  }

  if (message.attachments.size > config.attachmentsLimit) {
    errorRestrictions.push({
      code: TOO_MANY_ATTACHMENTS_CODE,
      reason: `:warning: Sorry, you've exceeded the limit of attachments per message (4)`,
    });
  }

  const unSupportedFileTypes = message.attachments
    .filter(attachment => {
      return !CHAT_COMPLETION_SUPPORTED_IMAGE_TYPES.includes(attachment?.contentType as string);
    })
    .map(attachment => attachment.contentType);

  if (unSupportedFileTypes.length > 0) {
    errorRestrictions.push({
      code: INVALID_FILE_TYPE_CODE,
      reason: `:warning: Sorry, I currently do not support the file types for the following file(s): ${unSupportedFileTypes}\n
      Supported file types: ${CHAT_COMPLETION_SUPPORTED_IMAGE_TYPES}`,
    });
  }

  return errorRestrictions;
}

async function processOpenAIMessageService(
  chatInstanceCollector: Collection<string, ChatInstance>,
  userMessageInstance: ChatInstance,
  collected: Message<boolean>[],
  user: User,
  finalResponse: MessageCreateOptions,
  endChat: boolean,
) {
  try {
    const chatCompletionMessages = chatCompletionService.formatChatCompletionMessages(
      collected,
      userMessageInstance?.selectedProfile,
    );

    const { content, toolCalls } = await chatCompletionService.processGenerativeResponse(
      chatCompletionMessages,
      userMessageInstance?.selectedProfile,
    );

    // This logic handles instances of tool calls during the message instance
    if (toolCalls && toolCalls.length > 0) {
      endChat = toolCalls[0].function.name === openaiToolsEnum.END_CHAT;
      finalResponse = await chatCompletionService.processOpenAIToolCalls(
        user,
        toolCalls,
        chatInstanceCollector,
        userMessageInstance,
        collected,
      );
    } else {
      finalResponse.content = content as string;
    }
    return {
      finalResponse,
      endChat,
    };
  } catch (error) {
    console.error('[Error] OpenAI service processing failed:', error);
    return {
      finalResponse: {
        content: 'Sorry, I encountered an error processing your request with OpenAI.',
      },
      endChat: false,
    };
  }
}

async function processAnthropicMessageService(
  chatInstanceCollector: Collection<string, ChatInstance>,
  userMessageInstance: ChatInstance,
  collected: Message<boolean>[],
  user: User,
  finalResponse: MessageCreateOptions,
  endChat: boolean,
) {
  try {
    const claudeMessages = messageService.formatClaudeMessages(collected);
    const { response, toolUse } = await messageService.processClaudeResponse(
      claudeMessages,
      userMessageInstance.selectedProfile,
    );

    if (!toolUse) {
      finalResponse.content = response;
    } else {
      endChat = toolUse.name === anthropicToolsEnum.END_CHAT;
      finalResponse = await messageService.processAnthropicToolCalls(
        user,
        toolUse,
        chatInstanceCollector,
        userMessageInstance,
        collected,
      );
    }
    return { finalResponse, endChat };
  } catch (error) {
    console.error('[Error] Anthropic service processing failed:', error);
    return {
      finalResponse: {
        content: 'Sorry, I encountered an error processing your request with Anthropic.',
      },
      endChat: false,
    };
  }
}

const directMessageEvent: Command = {
  name: Events.MessageCreate,
  async execute(message: Message) {
    const { singleInstanceCommands, chatInstanceCollector } = message.client;
    const { author: user, channel } = message;
    const { id: channelId, name: channelName } = channel as TextChannel;
    const { bot: isBot, id: userId } = user;
    const userChatInstance = chatInstanceCollector.get(userId);
    const isDirectMessage = channel.type === ChannelType.DM;
    const isBotMentioned = message.mentions.users.filter(usr => usr.id === config.botId).size > 0;

    // If the message is not a direct message and the bot is not mentioned we return
    if (!isBotMentioned && !isDirectMessage) {
      return;
    }

    // If the message event is coming from the bot we return
    if (isBot) {
      return;
    }

    // if the maximum amount of chat instances has been reached for the server we return
    if (chatInstanceCollector.size === config.messageCollectorsLimit) {
      return sendResponse(isDirectMessage, message, {
        content: `The max amount of my chat instances has been reached.`,
      });
    }

    // if a single instance command has been initiated in the current channel we return
    const setUserSingleInstanceCommand = singleInstanceCommands.find(cmd => {
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
        (colMsg.author.bot && colMsg.mentions.users.filter(usr => usr.id === userId).size > 0) ||
        // collect message if its a response to a user from the bot in a DM channel
        (isDirectMessage && colMsg.author.bot);
      const timeout =
        selectedProfile && selectedProfile.timeout
          ? Number(selectedProfile.timeout)
          : config.defaults.chatTimeout;
      const collector = (channel as TextChannel).createMessageCollector({
        filter: collectorFilter,
        idle: timeout,
      }) as MessageCollector;

      collector.on('collect', async lastMsg => {
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

        // validating the amount of attachments and  unsupported attachment file
        // types from the user's most recent message.
        const errorRestrictions = processAttachedFiles(lastMsg);
        if (errorRestrictions.length > 0) {
          // clearing all invalid attachments from the previous message to avoid
          // errors with invalid file types being passed.
          collected[collected.length - 1].attachments = new Collection<string, Attachment>();
          for (const errRes of errorRestrictions) {
            await sendResponse(isDirectMessage, message, {
              content: errRes.reason,
            });
          }
          return;
        }

        /**
         * determine the message logic flow based on the ai service the user has
         * selected. If the user has not created a profile then the we will fall
         * back to the default system service.
         **/
        let finalResponse: MessageCreateOptions = {};
        let endChat: boolean = false;
        userMessageInstance.isProcessing = true;

        const spinner = createSpinner(message, isDirectMessage);
        await spinner.start();

        try {
          switch (userMessageInstance.selectedProfile?.service) {
            case aiServiceEnums.ANTHROPIC: {
              const anthropicServiceResp = await processAnthropicMessageService(
                chatInstanceCollector,
                userMessageInstance,
                collected,
                user,
                finalResponse,
                endChat,
              );
              finalResponse = anthropicServiceResp.finalResponse;
              endChat = anthropicServiceResp.endChat;
              break;
            }
            default: {
              // adding default logic for users with no profile set.
              const openAIServiceResp = await processOpenAIMessageService(
                chatInstanceCollector,
                userMessageInstance,
                collected,
                user,
                finalResponse,
                endChat,
              );
              finalResponse = openAIServiceResp.finalResponse;
              endChat = openAIServiceResp.endChat;
              break;
            }
          }
        } catch (error) {
          console.error('[Error] AI service processing failed:', error);
          finalResponse = {
            content: 'Sorry, I encountered an unexpected error. Please try again.',
          };
          endChat = false;
        }

        const spinnerMessage = spinner.stop();
        userMessageInstance.isProcessing = false;
        chatInstanceCollector.set(userId, userMessageInstance);

        if (spinnerMessage) {
          try {
            await spinnerMessage.delete();
          } catch (error) {
            console.error('[Error] deleting spinner message:', error);
          }
        }
        await sendResponse(isDirectMessage, message, finalResponse);
        if (endChat) {
          collector.stop();
        }
      });
      collector.on('end', async collected => {
        try {
          if (collector.endReason === collectorEndReason.IDLE) {
            await sendResponse(isDirectMessage, message, {
              content: `Looks like you're no longer there ${user.username}. Our chat has ended.`,
            });
          }
          if (collector.endReason === collectorEndReason.USER) {
            await sendResponse(isDirectMessage, message, {
              content: `The chat session has ended :wave:`,
            });
          }

          const userMessageInstance = chatInstanceCollector.get(userId);
          if (userMessageInstance) {
            deleteTempFilesByTag(userMessageInstance?.interactionTag);
          }

          if (selectedProfile && selectedProfile.retention) {
            try {
              const collectedMsgs = Array.from(collected.values());
              switch (selectedProfile.service) {
                case aiServiceEnums.OPENAI: {
                  const retentionMsgs = chatCompletionService.formatChatCompletionMessages(
                    collectedMsgs,
                    selectedProfile,
                  );
                  await chatCompletionService.processOpenAiRetentionData(
                    retentionMsgs,
                    selectedProfile,
                  );
                  break;
                }
                case aiServiceEnums.ANTHROPIC: {
                  const claudeMessages = messageService.formatClaudeMessages(collectedMsgs);
                  await messageService.processAnthropicRetentionData(
                    claudeMessages,
                    selectedProfile,
                  );
                  break;
                }
              }
            } catch (error) {
              console.error('[Error] Processing retention data failed:', error);
            }
          }

          const terminationMsg = isDirectMessage
            ? `The DM chat has been terminated with ${user.username}`
            : `The channel chat has been terminated with ${user.username}`;
          const time = new Date();
          console.log(`${terminationMsg} - [time]: ${time.toLocaleString()}`);
          collected.clear();
          message.client.chatInstanceCollector.delete(user.id);
        } catch (error) {
          console.error('[Error] Collector end handler failed:', error);
          // Ensure cleanup even if other operations fail
          try {
            const userMessageInstance = chatInstanceCollector.get(userId);
            if (userMessageInstance) {
              deleteTempFilesByTag(userMessageInstance?.interactionTag);
            }
            message.client.chatInstanceCollector.delete(user.id);
          } catch (cleanupError) {
            console.error('[Error] Cleanup failed:', cleanupError);
          }
        }
      });

      // Programmatically triggering the message collector to fire on the initial message or mention to the bot.
      message.content = selectedProfile
        ? message.content.replace(/<@\d+>/g, selectedProfile.name)
        : message.content;
      collector.handleCollect(message);
    } catch (err) {
      console.error('[Error] Message event handler failed:', err);
      const userMessageInstance = chatInstanceCollector.get(userId);
      if (userMessageInstance) {
        try {
          deleteTempFilesByTag(userMessageInstance?.interactionTag);
        } catch (cleanupError) {
          console.error('[Error] Failed to delete temp files:', cleanupError);
        }
      }
      message.client.chatInstanceCollector.delete(user.id);
      await sendResponse(isDirectMessage, message, {
        content: 'Sorry looks like there was an issue. Our chat has ended.',
      });
    }
  },
};

export = directMessageEvent;
