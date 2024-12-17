import { EmbedBuilder, MessageCreateOptions, User } from 'discord.js';
import { OpenAi } from '../..';
import {
  chatToolsEnum,
  config,
  FinalResponse,
  imageModelEnums,
} from '../../config';
import { ChatInstance } from '../../shared/discord-js-types';
import {
  ChatCompletionMessage,
  chatCompletionRoles,
} from '../chatCompletion/chatCompletion.service';
import { ParsedFunctionToolCall } from 'openai/resources/beta/chat/completions';
import imagesService, { GenerateImageOptions } from '../images/images.service';

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
      tools: config.functionTools as any,
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
      case chatToolsEnum.GENERATE_IMAGE: {
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
      case chatToolsEnum.END_CHAT: {
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
