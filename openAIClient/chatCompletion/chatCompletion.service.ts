import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Message,
} from 'discord.js';
import { UserProfile } from '../../database/user_profiles/userProfilesDao';
import { ImagesResponse } from 'openai/resources';
import axios from 'axios';
import * as fs from 'fs';
import {
  GENERATIVE_RESPONSE_CONSTRAINTS,
  TEMP_FOLDER_PATH,
} from '../../shared/constants';
import { chatToolsEnum, IMAGE_PROCESSING_MODELS, textBasedModelEnums } from '../../config';
import * as z from 'zod';

export const CHAT_COMPLETION_SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

export interface ChatCompletionMessage {
  role: chatCompletionRoles;
  content: {
    type: chatCompletionTypes;
    text?: string;
    image_url?: {
      url: string;
    };
  }[];
  tool_call_id?: string;
}

export interface JsonContent {
  message: string;
  endChat: boolean;
}

export const chatCompletionStructuredResponse = z.object({
  message: z.string(),
  endChat: z.boolean(),
});

enum chatCompletionTypes {
  TEXT = 'text',
  IMAGE_URL = 'image_url',
}

enum chatCompletionRoles {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  TOOL = 'tool',
}

function generateSystemContentMessage(profile: string): ChatCompletionMessage {
  return {
    role: chatCompletionRoles.SYSTEM,
    content: [
      {
        type: chatCompletionTypes.TEXT,
        text: profile,
      },
    ],
  };
}

export default {
  formatChatCompletionMessages(
    messages: Message[],
    selectedProfile?: UserProfile,
  ): ChatCompletionMessage[] {
    let chatCompletionMessages: ChatCompletionMessage[] = messages.map(
      (message) => {
        let role: chatCompletionRoles = chatCompletionRoles.ASSISTANT;
        if (!message.author.bot) {
          role = chatCompletionRoles.USER;
        }
        if (message.author.bot && message.embeds.length > 0 && message.embeds[0].title === chatToolsEnum.CREATE_IMAGE) {
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
          chatCompletion.tool_call_id = message.embeds[0].fields[0].value;
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

          chatCompletion.content.push(...imageContents);
        }
        return chatCompletion;
      },
    );

    if (selectedProfile?.retention && selectedProfile.retentionData) {
      chatCompletionMessages = [
        ...selectedProfile.retentionData,
        ...chatCompletionMessages,
      ];
    }

    if (selectedProfile) {
      chatCompletionMessages.unshift(
        generateSystemContentMessage(selectedProfile.profile),
      );
    } else {
      chatCompletionMessages.unshift(
        generateSystemContentMessage(GENERATIVE_RESPONSE_CONSTRAINTS),
      );
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

  generateImageEmbeds(generatedImages: ImagesResponse, username: string) {
    const embeds = generatedImages.data.map((image) => {
      const imageUrl = image?.url as string;
      return new EmbedBuilder().setURL(imageUrl).setImage(imageUrl);
    });

    const title = `${username}'s image(s)`;

    embeds[0].setTitle(title);

    return embeds;
  },

  async downloadAndConvertImagesToJpeg(
    imageUrls: string[],
    username: string,
    interactionTag: number,
  ) {
    const imageFiles: string[] = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const imageFilePath = `${TEMP_FOLDER_PATH}/${username}-${interactionTag}-${i + 1}.jpeg`;
      await axios
        .get(imageUrls[i], {
          responseType: 'arraybuffer',
        })
        .then((response) => {
          fs.writeFileSync(imageFilePath, response.data);
          imageFiles.push(imageFilePath);
          console.log(`Image downloaded [image]: ${imageFilePath}`);
        })
        .catch((err) => {
          console.error(`Error downloading image:`, err);
        });
    }
    return imageFiles;
  },
};
