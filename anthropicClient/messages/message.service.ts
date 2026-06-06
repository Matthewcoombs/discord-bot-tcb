import { Collection, EmbedBuilder, Message, MessageCreateOptions, User } from 'discord.js';
import { Anthropic } from '../..';
import { anthropicToolsEnum, config, ProfileSettingsArgs, textBasedModelEnums } from '../../config';
import { MessageParam, ToolUseBlock } from '@anthropic-ai/sdk/resources';
import userProfilesDao, { UserProfile } from '../../database/user_profiles/userProfilesDao';
import imagesService, {
  GenerateImageOptions,
  EditImageOptions,
} from '../../openAIClient/images/images.service';
import {
  CLEAR_RETENTION_DATA,
  SELECT_CHAT_TIMEOUT_ID,
  SELECT_PROFILE_TEMPERATURE,
  SELECT_RETENTION_ID,
  SELECT_RETENTION_SIZE_ID,
  SELECT_TEXT_MODEL_ID,
} from '../../profiles/profiles.service';
import { ChatInstance } from '../../shared/discord-js-types';
import { getRemoteFileBufferData, getLatestImageMessageId } from '../../shared/utils';

enum messageRoleEnums {
  ASSISTANT = 'assistant',
  USER = 'user',
}

export default {
  formatClaudeMessages(messages: Message[]): MessageParam[] {
    const formatClaudeMessages: MessageParam[] = [];
    // Only the latest image-bearing user message keeps its image content. Older
    // images are dropped to avoid re-tokenizing vision content on every turn.
    const latestImageMessageId = getLatestImageMessageId(messages);
    messages.forEach(msg => {
      let role: messageRoleEnums = messageRoleEnums.ASSISTANT;
      if (!msg.author.bot) {
        role = messageRoleEnums.USER;
      }
      // Check if the message is from a bot and has an embed
      // this is indicative of a tool use
      if (
        msg.author.bot &&
        msg.embeds.length > 0 &&
        Object.values(anthropicToolsEnum).includes(msg.embeds[0].title as anthropicToolsEnum)
      ) {
        let toolResultContent = '';
        const toolName = msg.embeds[0].title as string;
        const toolUseId = msg.embeds[0].fields.find(field => field.name === 'id')?.value as string;
        const input = msg.embeds[0].fields.find(field => field.name === 'arguments')
          ?.value as string;

        // Check if the message is a tool use
        switch (msg.embeds[0].title) {
          case anthropicToolsEnum.GENERATE_IMAGE: {
            toolResultContent = `Successfully generated image(s)`;
            break;
          }
          case anthropicToolsEnum.IMAGE_EDIT: {
            toolResultContent = `Successfully edited image(s)`;
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
        const messageContent: any[] = [
          {
            type: 'text',
            text: msg.content,
          },
        ];

        // Add image attachments only for the latest image-bearing user message
        if (!msg.author.bot && msg.id === latestImageMessageId && msg.attachments.size > 0) {
          msg.attachments.forEach(attachment => {
            if (attachment.contentType?.startsWith('image/')) {
              messageContent.push({
                type: 'image',
                source: {
                  type: 'url',
                  url: attachment.url,
                },
              });
            }
          });
        }

        formatClaudeMessages.push({
          role,
          content: messageContent,
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
        latestSelectedProfile.optimizedAnthropicRetentionData = condensedConversation;
      } catch (err) {
        console.error('[ERROR] - There was an error processing the anthropic retention data', err);
        latestSelectedProfile.optimizedAnthropicRetentionData = '';
      }
    } else {
      latestSelectedProfile.anthropicRetentionData = [
        ...(selectedProfile.anthropicRetentionData || []),
        ...claudeMessages,
      ];
    }
    await userProfilesDao.updateUserProfile(latestSelectedProfile);
  },

  async processClaudeResponse(claudeMessages: Array<MessageParam>, selectedProfile?: UserProfile) {
    let response = '';
    let toolUse;
    if (
      selectedProfile?.retention &&
      selectedProfile.anthropicRetentionData &&
      selectedProfile.anthropicRetentionData.length > 0
    ) {
      claudeMessages = [...selectedProfile.anthropicRetentionData, ...claudeMessages];
    }

    const systemMessage =
      selectedProfile?.retention && selectedProfile?.retentionSize === 0
        ? `${selectedProfile.profile}\nConversation history:${selectedProfile.optimizedAnthropicRetentionData}`
        : selectedProfile?.profile || '';

    /**
     * Prompt caching. Anthropic caches the static prefix of a request (tools,
     * then system) so it is not re-tokenized on every turn. We place one cache
     * breakpoint on the last tool — this caches the entire tools block, which is
     * identical for every user/session and therefore gets a very high hit rate —
     * and one on the system prompt, which is stable across turns within a
     * session. Cached input reads cost a fraction of normal input tokens.
     */
    const anthropicTools = config.anthropic.tools as any[];
    const cachedTools = anthropicTools.map((tool, index) =>
      index === anthropicTools.length - 1
        ? { ...tool, cache_control: { type: 'ephemeral' } }
        : tool,
    );

    // Only mark the system block when it has content. Anthropic rejects empty
    // text blocks, and the no-profile path produces an empty system string.
    const system = systemMessage
      ? [{ type: 'text' as const, text: systemMessage, cache_control: { type: 'ephemeral' as const } }]
      : systemMessage;

    const message = await Anthropic.messages.create({
      model: selectedProfile ? selectedProfile.textModel : config.anthropic.defaultMessageModel,
      messages: claudeMessages,
      tools: cachedTools,
      max_tokens: 1024,
      system,
      temperature: Number(selectedProfile?.temperature),
    });

    if (message.stop_reason === 'end_turn') {
      const content = message.content.filter(contentBlock => {
        return contentBlock.type === 'text';
      })[0];
      response = content.text;
    }

    if (message.stop_reason === 'tool_use') {
      toolUse = message.content.filter(contentBlock => {
        return contentBlock.type === 'tool_use';
      })[0];
    }
    return { response, toolUse };
  },

  async processAnthropicToolCalls(
    user: User,
    toolCalls: ToolUseBlock,
    ChatInstanceCollector: Collection<string, ChatInstance>,
    userChatInstance: ChatInstance,
    messages?: Message[],
  ): Promise<MessageCreateOptions> {
    let toolResponse: MessageCreateOptions = {};
    const { interactionTag } = userChatInstance;
    const { name: toolName, input, id, type } = toolCalls;
    const toolEmbed = new EmbedBuilder()
      .setTitle(`🔧 ${toolName}`)
      .setColor(0xff6b35)
      .setTimestamp()
      .addFields(
        { name: '🆔 ID', value: `\`${id}\``, inline: true },
        { name: '⚙️ Type', value: `\`${type}\``, inline: true },
        {
          name: '📋 Arguments',
          value: `\`\`\`json\n${JSON.stringify(input, null, 2)}\`\`\``,
          inline: false,
        },
      )
      .setFooter({ text: 'Anthropic Tool Call' });

    switch (toolName) {
      case anthropicToolsEnum.GENERATE_IMAGE: {
        const toolCallImageOptions = {
          ...(input as GenerateImageOptions),
        };
        // Validation is required as the model may sometimes hallucinate and
        // generate invalid arguments
        if (!imagesService.validateImageCreationOptions(toolCallImageOptions)) {
          toolResponse.content = `Sorry it looks like the arguments provided for image generation are invalid. Please try again!`;
        }
        const imageOptions: GenerateImageOptions =
          imagesService.translateToolCallImageOptionsToGenerateImageOptions(toolCallImageOptions);
        const imageFiles = await imagesService.generateImages(user, imageOptions, interactionTag);
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
      case anthropicToolsEnum.IMAGE_EDIT: {
        const toolCallEditOptions = input as any;
        if (!imagesService.validateImageEditOptions(toolCallEditOptions)) {
          toolResponse.content = `Sorry it looks like the arguments provided for image editing are invalid. Please try again!`;
          break;
        }

        // Find the most recent user message with an image attachment
        const lastUserMessage = messages
          ?.slice()
          .reverse()
          .find(msg => !msg.author.bot && msg.attachments.size > 0);

        if (!lastUserMessage || lastUserMessage.attachments.size === 0) {
          toolResponse.content = `Sorry, I couldn't find an image to edit. Please upload an image and try again.`;
          break;
        }

        const imageAttachment = lastUserMessage.attachments.first();
        if (!imageAttachment) {
          toolResponse.content = `Sorry, I couldn't access the image attachment. Please try again.`;
          break;
        }

        try {
          const imageBuffer = await getRemoteFileBufferData(imageAttachment.url);
          const editOptions: EditImageOptions =
            imagesService.translateToolCallImageOptionsToEditImageOptions(toolCallEditOptions);
          const imageFiles = await imagesService.editImages(
            user,
            editOptions,
            imageBuffer,
            interactionTag,
          );

          toolResponse = {
            content:
              imageFiles.length > 1
                ? `Here are your edited images ${user.username} :blush:`
                : `Here is your edited image ${user.username} :blush:`,
            files: imageFiles,
            embeds: [toolEmbed],
          };
        } catch (error) {
          console.error('Error editing image:', error);
          toolResponse.content = `Sorry, I encountered an error while editing your image. Please try again.`;
        }
        break;
      }
      case anthropicToolsEnum.PROFILE_SETTINGS: {
        const selectedProfile = await userProfilesDao.getSelectedProfile(user.id);
        const profileSettings = input as ProfileSettingsArgs;
        for (const selectedSetting of profileSettings.selectedSettings) {
          if (selectedSetting === SELECT_TEXT_MODEL_ID) {
            selectedProfile.textModel = profileSettings.textModel as textBasedModelEnums;
          }
          if (selectedSetting === SELECT_CHAT_TIMEOUT_ID) {
            selectedProfile.timeout = Number(profileSettings.timeout);
          }
          if (selectedSetting === SELECT_RETENTION_ID) {
            selectedProfile.retention = profileSettings.retention === 'true';
          }
          if (selectedSetting === SELECT_RETENTION_SIZE_ID) {
            selectedProfile.retentionSize = Number(profileSettings.retentionSize);
          }
          if (selectedSetting === CLEAR_RETENTION_DATA) {
            if (profileSettings.clearRetentionData === 'true') {
              selectedProfile.optimizedOpenAiRetentionData = '';
              selectedProfile.optimizedAnthropicRetentionData = '';
              selectedProfile.openAiRetentionData = [];
              selectedProfile.anthropicRetentionData = [];
            }
          }
          if (selectedSetting === SELECT_PROFILE_TEMPERATURE) {
            selectedProfile.temperature = Number(profileSettings.temperature);
          }
        }
        userChatInstance.selectedProfile = selectedProfile;
        ChatInstanceCollector.set(user.id, userChatInstance);
        await userProfilesDao.updateUserProfile(selectedProfile);
        toolResponse = {
          content: `Successfully updated profile setting(s) - **${profileSettings.selectedSettings}**`,
          embeds: [toolEmbed],
        };
        break;
      }
      case anthropicToolsEnum.VIEW_PROFILE_SETTINGS: {
        const selectedProfile = await userProfilesDao.getSelectedProfile(user.id);
        if (!selectedProfile) {
          toolResponse.content = 'You do not have any profile selected.';
          break;
        }

        const settingsText =
          `**Profile: ${selectedProfile.name}**\n` +
          `• AI Service: ${selectedProfile.service}\n` +
          `• Text Model: ${selectedProfile.textModel}\n` +
          `• Temperature: ${selectedProfile.temperature}\n` +
          `• Chat Timeout: ${Math.floor(Number(selectedProfile.timeout) / 1000 / 60)} minutes\n` +
          `• Retention: ${selectedProfile.retention ? 'Enabled' : 'Disabled'}\n` +
          `• Retention Size: ${selectedProfile.retentionSize}\n` +
          `• Created: ${new Date(selectedProfile.createdAt).toLocaleDateString()}\n` +
          `• Updated: ${new Date(selectedProfile.updatedAt).toLocaleDateString()}`;

        toolEmbed.setDescription(settingsText);
        toolResponse = {
          content: 'Here are your current profile settings',
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
