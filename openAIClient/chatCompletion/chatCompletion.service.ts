import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
} from 'discord.js';
import { UserProfile } from '../../database/user_profiles/userProfilesDao';
import {
  openaiToolsEnum,
  IMAGE_PROCESSING_MODELS,
  textBasedModelEnums,
  config,
} from '../../config';

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

  generateUserProfileDisplay(userProfiles: UserProfile[]) {
    const buttons = userProfiles.map((profile) => {
      return new ButtonBuilder()
        .setCustomId(profile.id.toString())
        .setLabel(profile.name)
        .setStyle(profile.selected ? ButtonStyle.Success : ButtonStyle.Primary);
    });

    const row = new ActionRowBuilder().addComponents(buttons);

    return row;
  },
};
