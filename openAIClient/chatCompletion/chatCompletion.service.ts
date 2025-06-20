import {
  Collection,
  EmbedBuilder,
  Message,
  MessageCreateOptions,
  User,
} from 'discord.js';
import userProfilesDao, {
  UserProfile,
} from '../../database/user_profiles/userProfilesDao';
import {
  openaiToolsEnum,
  IMAGE_PROCESSING_MODELS,
  textBasedModelEnums,
  config,
  FinalResponse,
  ProfileSettingsArgs,
  DEFAULT_OPENAI_TOOLS,
} from '../../config';
import { OpenAi } from '../..';
import imagesService, {
  GenerateImageOptions,
  ToolCallGenerateImageOptions,
} from '../images/images.service';
import {
  CLEAR_RETENTION_DATA,
  SELECT_CHAT_TIMEOUT_ID,
  SELECT_PROFILE_TEMPERATURE,
  SELECT_RETENTION_ID,
  SELECT_RETENTION_SIZE_ID,
  SELECT_TEXT_MODEL_ID,
} from '../../profiles/profiles.service';
import { ChatCompletionMessageToolCall } from 'openai/resources';
import { ChatInstance } from '../../shared/discord-js-types';

export const CHAT_COMPLETION_SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

export interface ChatCompletionMessage {
  role?: chatCompletionRoles;
  content?: {
    type: chatCompletionTypes;
    text?: string;
    image_url?: {
      url: string;
    };
  }[];
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: 'function';
    function: {
      arguments: string;
      name: string;
    };
  }[];
}

export interface JsonContent {
  message: string;
  endChat: boolean;
}

enum chatCompletionTypes {
  TEXT = 'text',
  IMAGE_URL = 'image_url',
}

export enum chatCompletionRoles {
  DEVELOPER = 'developer',
  USER = 'user',
  ASSISTANT = 'assistant',
  TOOL = 'tool',
}

export const CONDENSED_CONVO_PROMPT: ChatCompletionMessage = {
  role: chatCompletionRoles.USER,
  content: [
    {
      type: chatCompletionTypes.TEXT,
      text: `Condense this conversation into a short summary. Include only the most relevant information and remove any unnecessary details. The summary should be concise and to the point.`,
    },
  ],
};

function generateDeveloperContentMessage(
  chatCompletionMessages: ChatCompletionMessage[],
  selectedProfile?: UserProfile,
): ChatCompletionMessage[] {
  let profileText;
  if (selectedProfile) {
    profileText =
      selectedProfile.retention && selectedProfile.retentionSize === 0
        ? `${selectedProfile.profile}\nConversation history:${selectedProfile.optimizedOpenAiRetentionData}`
        : selectedProfile.profile;
  }

  const developerMessage = {
    role: chatCompletionRoles.DEVELOPER,
    content: [
      {
        type: chatCompletionTypes.TEXT,
        text: profileText
          ? `${profileText}\n${config.generativeConstraints}`
          : config.generativeConstraints,
      },
    ],
  };

  chatCompletionMessages.unshift(developerMessage);
  return chatCompletionMessages;
}

export default {
  formatChatCompletionMessages(
    messages: Message[],
    selectedProfile?: UserProfile,
  ): ChatCompletionMessage[] {
    let chatCompletionMessages = messages.reduce(
      (acc: ChatCompletionMessage[], message) => {
        let role: chatCompletionRoles = chatCompletionRoles.ASSISTANT;
        if (!message.author.bot) {
          role = chatCompletionRoles.USER;
        }
        if (
          message.author.bot &&
          message.embeds.length > 0 &&
          Object.values(openaiToolsEnum).includes(
            message.embeds[0].title as openaiToolsEnum,
          )
        ) {
          role = chatCompletionRoles.TOOL;
        }

        const chatCompletion: ChatCompletionMessage = {
          role,
          content: [
            {
              type: chatCompletionTypes.TEXT,
              text: message.content,
            },
          ],
        };

        if (role === chatCompletionRoles.TOOL) {
          const functionName = message.embeds[0].title as string;
          const toolCallId = message.embeds[0].fields[0].value;
          const args = message.embeds[0].fields[2].value;
          chatCompletion.tool_call_id = toolCallId;

          // simulating the tool call response before the tool result
          const toolCallResponse: ChatCompletionMessage = {
            role: chatCompletionRoles.ASSISTANT,
            tool_calls: [
              {
                id: toolCallId,
                type: 'function',
                function: { arguments: args, name: functionName },
              },
            ],
          };

          acc.push(toolCallResponse);
        }

        if (
          message.attachments &&
          IMAGE_PROCESSING_MODELS.includes(
            selectedProfile?.textModel as textBasedModelEnums,
          ) &&
          !message.author.bot
        ) {
          const imageContents = message.attachments.map((attachment) => {
            return {
              type: chatCompletionTypes.IMAGE_URL,
              image_url: {
                url: attachment.url,
              },
            };
          });

          chatCompletion?.content?.push(...imageContents);
        }

        acc.push(chatCompletion);
        return acc;
      },
      [],
    );

    if (selectedProfile?.retention && selectedProfile.openAiRetentionData) {
      chatCompletionMessages = [
        ...selectedProfile.openAiRetentionData,
        ...chatCompletionMessages,
      ];
    }

    if (chatCompletionMessages[0].role !== chatCompletionRoles.DEVELOPER) {
      generateDeveloperContentMessage(chatCompletionMessages, selectedProfile);
    }
    return chatCompletionMessages;
  },

  cleanChatCompletionMsgs(chatCompMsgs: ChatCompletionMessage[]) {
    const cleanedMsgs = chatCompMsgs.reduce((acc, compMsg) => {
      if (
        compMsg.role !== chatCompletionRoles.DEVELOPER &&
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
  },

  async processOpenAiRetentionData(
    chatCompMsgs: ChatCompletionMessage[],
    selectedProfile: UserProfile,
  ) {
    /**
     * Pulling the latest user profile from the database to ensure that we are
     * updating the correct profile.
     **/
    const latestSelectedProfile = await userProfilesDao.getSelectedProfile(
      selectedProfile.discordId,
    );

    /**
     * If retention size is set to 0, we do not save messages, but instead we update
     * the profile with a condensed version of the conversation history.
     **/
    if (selectedProfile.retentionSize === 0) {
      try {
        chatCompMsgs.push(CONDENSED_CONVO_PROMPT);
        const chatCompletion = await OpenAi.chat.completions.create({
          model: selectedProfile.textModel,
          messages: chatCompMsgs as any,
          response_format: { type: 'text' },
          temperature: Number(selectedProfile.temperature),
        });
        const condensedConversation = chatCompletion.choices[0].message.content;
        latestSelectedProfile.optimizedOpenAiRetentionData =
          condensedConversation as string;
      } catch (_) {
        latestSelectedProfile.optimizedOpenAiRetentionData = '';
      }
    } else {
      const cleanedMsgs = this.cleanChatCompletionMsgs(chatCompMsgs);
      latestSelectedProfile.openAiRetentionData = cleanedMsgs;
    }
    await userProfilesDao.updateUserProfile(latestSelectedProfile);
  },

  async processGenerativeResponse(
    chatCompletionMessages: ChatCompletionMessage[],
    selectedProfile?: UserProfile,
  ) {
    const chatCompletion = await OpenAi.chat.completions.create({
      model: selectedProfile
        ? selectedProfile.textModel
        : config.openAi.defaultChatCompletionModel,
      response_format: { type: 'text' },
      messages: chatCompletionMessages as any,
      tools: selectedProfile
        ? (config.openAi.tools as any)
        : (DEFAULT_OPENAI_TOOLS as any),
      temperature: Number(selectedProfile?.temperature),
    });

    const content = chatCompletion.choices[0].message.content;
    const toolCalls = chatCompletion.choices[0].message.tool_calls;

    return { content, toolCalls };
  },

  async processOpenAIToolCalls(
    user: User,
    toolCalls: ChatCompletionMessageToolCall[],
    ChatInstanceCollector: Collection<string, ChatInstance>,
    userChatInstance: ChatInstance,
  ): Promise<MessageCreateOptions> {
    let toolResponse: MessageCreateOptions = {};
    const { interactionTag } = userChatInstance;
    const toolCall = toolCalls[0];
    const { id, type } = toolCall;
    const { name: toolName, arguments: toolArgs } = toolCall.function;

    const toolEmbed = new EmbedBuilder().setTitle(toolName).setFields([
      { name: 'id', value: id, inline: true },
      { name: 'type', value: type, inline: true },
      { name: 'arguments', value: toolCall.function.arguments, inline: true },
    ]);

    switch (toolName) {
      case openaiToolsEnum.GENERATE_IMAGE: {
        const toolCallImageOptions = JSON.parse(
          toolArgs,
        ) as ToolCallGenerateImageOptions;
        // Validation is required as the model may sometimes hallucinate and
        // generate invalid arguments
        if (!imagesService.validateImageCreationOptions(toolCallImageOptions)) {
          toolResponse.content = `Sorry it looks like the arguments provided for image generation are invalid. Please try again!`;
          break;
        }
        const imageOptions: GenerateImageOptions =
          imagesService.translateToolCallImageOptionsToGenerateImageOptions(
            toolCallImageOptions,
          );
        const imageFiles = await imagesService.generateImages(
          user,
          imageOptions,
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
      case openaiToolsEnum.PROFILE_SETTINGS: {
        const selectedProfile = await userProfilesDao.getSelectedProfile(
          user.id,
        );
        const settingUpdateArgs = {
          ...(JSON.parse(toolArgs) as ProfileSettingsArgs),
        };
        for (const selectedSetting of settingUpdateArgs.selectedSettings) {
          if (selectedSetting === SELECT_TEXT_MODEL_ID) {
            selectedProfile.textModel =
              settingUpdateArgs.textModel as textBasedModelEnums;
          }
          if (selectedSetting === SELECT_CHAT_TIMEOUT_ID) {
            selectedProfile.timeout = Number(settingUpdateArgs.timeout);
          }
          if (selectedSetting === SELECT_RETENTION_ID) {
            selectedProfile.retention = settingUpdateArgs.retention === 'true';
          }
          if (selectedSetting === SELECT_RETENTION_SIZE_ID) {
            selectedProfile.retentionSize = Number(
              settingUpdateArgs.retentionSize,
            );
          }
          if (selectedSetting === CLEAR_RETENTION_DATA) {
            if (settingUpdateArgs.clearRetentionData === 'true') {
              selectedProfile.optimizedOpenAiRetentionData = '';
              selectedProfile.optimizedAnthropicRetentionData = '';
              selectedProfile.openAiRetentionData = [];
              selectedProfile.anthropicRetentionData = [];
            }
          }
          if (selectedSetting === SELECT_PROFILE_TEMPERATURE) {
            selectedProfile.temperature = Number(settingUpdateArgs.temperature);
          }
        }
        userChatInstance.selectedProfile = selectedProfile;
        ChatInstanceCollector.set(user.id, userChatInstance);
        await userProfilesDao.updateUserProfile(selectedProfile);
        toolResponse = {
          content: `successfully updated user profile setting(s) - **${settingUpdateArgs.selectedSettings}**`,
          embeds: [toolEmbed],
        };

        break;
      }
      case openaiToolsEnum.END_CHAT: {
        const endChatParams = JSON.parse(toolArgs) as FinalResponse;
        toolResponse.content = `${endChatParams.finalResponse}`;
        break;
      }
      default:
        break;
    }
    return toolResponse;
  },
};
