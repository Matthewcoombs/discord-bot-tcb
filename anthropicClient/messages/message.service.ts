import { EmbedBuilder, Message, MessageCreateOptions, User } from 'discord.js';
import { Anthropic } from '../..';
import { anthropicToolsEnum, config, imageModelEnums } from '../../config';
import { MessageParam, ToolUseBlock } from '@anthropic-ai/sdk/resources';
import userProfilesDao, {
  UserProfile,
} from '../../database/user_profiles/userProfilesDao';
import imagesService, {
  GenerateImageOptions,
} from '../../openAIClient/images/images.service';

enum messageRoleEnums {
  ASSISTANT = 'assistant',
  USER = 'user',
}

export default {
  formatClaudeMessages(messages: Message[]): MessageParam[] {
    const formatClaudeMessages: MessageParam[] = [];
    messages.forEach((msg) => {
      let role: messageRoleEnums = messageRoleEnums.ASSISTANT;
      if (!msg.author.bot) {
        role = messageRoleEnums.USER;
      }
      // Check if the message is from a bot and has an embed
      // this is indicative of a tool use
      if (
        msg.author.bot &&
        msg.embeds.length > 0 &&
        Object.values(anthropicToolsEnum).includes(
          msg.embeds[0].title as anthropicToolsEnum,
        )
      ) {
        let toolResultContent = '';
        const toolName = msg.embeds[0].title as string;
        const toolUseId = msg.embeds[0].fields.find(
          (field) => field.name === 'id',
        )?.value as string;
        const input = msg.embeds[0].fields.find(
          (field) => field.name === 'arguments',
        )?.value as string;

        // Check if the message is a tool use
        switch (msg.embeds[0].title) {
          case anthropicToolsEnum.GENERATE_IMAGE: {
            toolResultContent = `Successfully generated image(s)`;
            break;
          }
        }

        // pushing tool usage
        formatClaudeMessages.push({
          role,
          content: [
            {
              type: 'tool_use',
              name: toolName,
              id: toolUseId,
              input: JSON.parse(input),
            },
          ],
        });
        // pushing tool usage result
        formatClaudeMessages.push({
          // Anthropic requires all tool_result blocks have a role of 'user'
          role: messageRoleEnums.USER,
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: toolResultContent,
            },
          ],
        });
      } else {
        formatClaudeMessages.push({
          role,
          content: [
            {
              type: 'text',
              text: msg.content,
            },
          ],
        });
      }
    });
    return formatClaudeMessages;
  },

  async processAnthropicRetentionData(
    claudeMessages: Array<MessageParam>,
    selectedProfile: UserProfile,
  ) {
    /**
     * If retention size is set to 0, we do not save messages, but instead we update
     * the profile with a condensed version of the conversation history.
     **/
    if (selectedProfile.retentionSize === 0) {
      try {
        claudeMessages.push({
          role: messageRoleEnums.USER,
          content: [
            {
              type: 'text',
              text: `Condense this conversation into a short summary. Include only the most relevant information and remove any unnecessary details. The summary should be concise and to the point.`,
            },
          ],
        });
        const message = await Anthropic.messages.create({
          model: selectedProfile.textModel,
          messages: claudeMessages,
          max_tokens: 1024,
          system: selectedProfile.profile,
          temperature: Number(selectedProfile.temperature),
        });

        const condensedConversation =
          message.content[0].type === 'text' ? message.content[0].text : '';
        selectedProfile.optimizedAnthropicRetentionData = condensedConversation;
      } catch (_) {
        selectedProfile.optimizedAnthropicRetentionData = '';
      }
    } else {
      selectedProfile.anthropicRetentionData = [
        ...(selectedProfile.anthropicRetentionData || []),
        ...claudeMessages,
      ];
    }
    await userProfilesDao.updateUserProfile(selectedProfile);
  },

  async processClaudeResponse(
    claudeMessages: Array<MessageParam>,
    selectedProfile?: UserProfile,
  ) {
    let response = '';
    let toolUse;
    if (
      selectedProfile?.retention &&
      selectedProfile.anthropicRetentionData &&
      selectedProfile.anthropicRetentionData.length > 0
    ) {
      claudeMessages = [
        ...selectedProfile.anthropicRetentionData,
        ...claudeMessages,
      ];
    }

    const systemMessage =
      selectedProfile?.retention && selectedProfile?.retentionSize === 0
        ? `${selectedProfile.profile}\nConversation history:${selectedProfile.optimizedAnthropicRetentionData}`
        : selectedProfile?.profile || '';

    const message = await Anthropic.messages.create({
      model: selectedProfile
        ? selectedProfile.textModel
        : config.anthropic.defaultMessageModel,
      messages: claudeMessages,
      tools: config.anthropic.tools as any,
      max_tokens: 1024,
      system: systemMessage,
      temperature: Number(selectedProfile?.temperature),
    });

    if (message.stop_reason === 'end_turn') {
      const content = message.content.filter((contentBlock) => {
        return contentBlock.type === 'text';
      })[0];
      response = content.text;
    }

    if (message.stop_reason === 'tool_use') {
      toolUse = message.content.filter((contentBlock) => {
        return contentBlock.type === 'tool_use';
      })[0];
    }
    return { response, toolUse };
  },

  async processAnthropicToolCalls(
    user: User,
    toolCalls: ToolUseBlock,
    interactionTag: number,
  ): Promise<MessageCreateOptions> {
    let toolResponse: MessageCreateOptions = {};
    const { name: toolName, input, id, type } = toolCalls;
    const toolEmbed = new EmbedBuilder().setTitle(toolName).setFields([
      { name: 'id', value: id as string, inline: true },
      { name: 'type', value: type as string, inline: true },
      { name: 'arguments', value: JSON.stringify(input), inline: true },
    ]);

    switch (toolName) {
      case anthropicToolsEnum.GENERATE_IMAGE: {
        const imageGenerateOptions = {
          ...(input as GenerateImageOptions),
          model: imageModelEnums.DALLE3,
        };
        imageGenerateOptions.count = Number(imageGenerateOptions.count);
        // Validation is required as the model may sometimes hallucinate and
        // generate invalid arguments
        if (!imagesService.validateImageCreationOptions(imageGenerateOptions)) {
          toolResponse.content = `Sorry it looks like the arguments provided for image generation are invalid. Please try again!`;
        }
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
      case anthropicToolsEnum.END_CHAT: {
        const endChatParams = input as {
          finalResponse: string;
        };
        toolResponse.content = `${endChatParams.finalResponse}`;
        break;
      }
      default:
        break;
    }
    return toolResponse;
  },
};
