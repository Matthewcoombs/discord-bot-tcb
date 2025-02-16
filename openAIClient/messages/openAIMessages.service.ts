import { EmbedBuilder, MessageCreateOptions, User } from 'discord.js';
import { OpenAi } from '../..';
import {
  openaiToolsEnum,
  config,
  FinalResponse,
  imageModelEnums,
} from '../../config';
import { ChatInstance } from '../../shared/discord-js-types';
import {
  ChatCompletionMessage,
  chatCompletionRoles,
  CONDENSED_CONVO_PROMPT,
} from '../chatCompletion/chatCompletion.service';
import { ParsedFunctionToolCall } from 'openai/resources/beta/chat/completions';
import imagesService, { GenerateImageOptions } from '../images/images.service';
import userProfilesDao, {
  UserProfile,
} from '../../database/user_profiles/userProfilesDao';

export default {
  cleanChatCompletionMsgs(chatCompMsgs: ChatCompletionMessage[]) {
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
  },

  async processOpenAiRetentionData(
    chatCompMsgs: ChatCompletionMessage[],
    selectedProfile: UserProfile,
  ) {
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
        });
        const condensedConversation = chatCompletion.choices[0].message.content;
        selectedProfile.optimizedOpenAiRetentionData =
          condensedConversation as string;
      } catch (_) {
        selectedProfile.optimizedOpenAiRetentionData = '';
      }
    } else {
      const cleanedMsgs = this.cleanChatCompletionMsgs(chatCompMsgs);
      selectedProfile.openAiRetentionData = cleanedMsgs;
    }
    await userProfilesDao.updateUserProfile(selectedProfile);
  },

  async processGenerativeResponse(
    userMessageInstance: ChatInstance,
    chatCompletionMessages: ChatCompletionMessage[],
  ) {
    const chatCompletion = await OpenAi.chat.completions.create({
      model: userMessageInstance?.selectedProfile
        ? userMessageInstance.selectedProfile.textModel
        : config.openAi.defaultChatCompletionModel,
      response_format: { type: 'text' },
      messages: chatCompletionMessages as any,
      tools: config.openAIfunctionTools as any,
    });

    const content = chatCompletion.choices[0].message.content;
    const toolCalls = chatCompletion.choices[0].message.tool_calls;

    return { content, toolCalls };
  },

  async processToolCalls(
    user: User,
    toolCalls: ParsedFunctionToolCall[],
    interactionTag: number,
  ): Promise<MessageCreateOptions> {
    let toolResponse: MessageCreateOptions = {};
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
        const imageGenerateOptions = {
          ...(JSON.parse(toolArgs) as GenerateImageOptions),
          model: imageModelEnums.DALLE3,
        };
        imageGenerateOptions.count = Number(imageGenerateOptions.count);
        // Validation is required as the model may sometimes hallucinate and
        // generate invalid arguments
        if (!imagesService.validateImageCreationOptions(imageGenerateOptions)) {
          toolResponse.content = `Sorry it looks like the arguments provided for image generation are invalid. Please try again!`;
          break;
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
