import { Message } from 'discord.js';
import { ChatInstance } from '../../shared/discord-js-types';
import { Anthropic } from '../..';
import { anthropicToolsEnum, config } from '../../config';
import { MessageParam } from '@anthropic-ai/sdk/resources';
import userProfilesDao, {
  UserProfile,
} from '../../database/user_profiles/userProfilesDao';

enum messageRoleEnums {
  ASSISTANT = 'assistant',
  USER = 'user',
}

export default {
  formatClaudeMessages(messages: Message[]): MessageParam[] {
    return messages.map((msg) => {
      return {
        role: msg.author.bot
          ? messageRoleEnums.ASSISTANT
          : messageRoleEnums.USER,
        content: [
          {
            type: 'text',
            text: msg.content,
          },
        ],
      };
    });
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
    userMessageInstance: ChatInstance,
    endChat: boolean,
  ) {
    const selectedProfile = userMessageInstance?.selectedProfile;
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
      model: userMessageInstance?.selectedProfile
        ? userMessageInstance.selectedProfile.textModel
        : config.claude.defaultMessageModel,
      messages: claudeMessages,
      tools: config.claudeFunctionTools as any,
      max_tokens: 1024,
      system: systemMessage,
    });

    let response = '';
    const content = message.content[0];

    if (content.type === 'text') {
      response = content.text;
      return { response, endChat };
    }

    if (content.type === 'tool_use') {
      switch (content.name) {
        case anthropicToolsEnum.END_CHAT: {
          endChat = true;
          if (
            content.input &&
            typeof content.input === 'object' &&
            'finalResponse' in content.input
          ) {
            response = content.input.finalResponse as string;
          }
          return { response, endChat };
        }
      }
    }
    return { response, endChat };
  },
};
