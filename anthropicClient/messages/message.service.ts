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
    selectedProfile.anthropicRetentionData = claudeMessages;
    await userProfilesDao.updateUserProfile(selectedProfile);
  },

  async processClaudeResponse(
    claudeMessages: Array<MessageParam>,
    userMessageInstance: ChatInstance,
    endChat: boolean,
  ) {
    const selectedProfile = userMessageInstance?.selectedProfile;
    if (selectedProfile?.retention && selectedProfile.anthropicRetentionData) {
      claudeMessages = [
        ...selectedProfile.anthropicRetentionData,
        ...claudeMessages,
      ];
    }
    const message = await Anthropic.messages.create({
      model: userMessageInstance?.selectedProfile
        ? userMessageInstance.selectedProfile.textModel
        : config.claude.defaultMessageModel,
      messages: claudeMessages,
      tools: config.claudeFunctionTools as any,
      max_tokens: 1024,
      system: userMessageInstance?.selectedProfile
        ? userMessageInstance.selectedProfile.profile
        : '',
    });

    console.log('testing claude response:', message.content[0]);

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
