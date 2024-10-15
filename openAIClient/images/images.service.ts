import { ActionRowBuilder, ButtonBuilder, ButtonStyle, User } from 'discord.js';
import { imageModelEnums } from '../../config';
import { ImageGenerateParams } from 'openai/resources';
import { OpenAi } from '../..';
import chatCompletionService from '../chatCompletion/chatCompletion.service';

export interface GenerateImageOptions {
  model?: imageModelEnums;
  description: string;
  quality?: string;
  style?: string;
  count: number;
  size: string;
}

export default {
  generateImageSizeSelection(imageModel: imageModelEnums) {
    const dalle2ImageSizes = ['256x256', '512x512', '1024x1024'];
    const dalle3ImageSizes = ['1024x1024', '1792x1024', '1024x1792'];

    const imageSizesToDisplay =
      imageModel === imageModelEnums.DALLE3
        ? dalle3ImageSizes
        : dalle2ImageSizes;

    const buttons = imageSizesToDisplay.map((size) => {
      return new ButtonBuilder()
        .setCustomId(size)
        .setLabel(size)
        .setStyle(ButtonStyle.Primary);
    });

    const row = new ActionRowBuilder().addComponents(buttons);

    return row;
  },

  async generateImages(
    user: User,
    imageOptions: GenerateImageOptions,
    interactionTag: number,
  ) {
    const model = imageOptions.model;
    const imagesToCreatePromises = Array(imageOptions.count)
      .fill(imageOptions)
      .map((imageOpt: GenerateImageOptions) => {
        const imageGenerateParams: ImageGenerateParams = {
          prompt: imageOpt.description,
          model: imageOpt.model,
          n: imageOpt.count,
          size: imageOpt.size as
            | '256x256'
            | '512x512'
            | '1024x1024'
            | '1792x1024'
            | '1024x1792'
            | null
            | undefined,
        };
        if (model === imageModelEnums.DALLE3) {
          imageGenerateParams.n = 1;
          imageGenerateParams.quality = imageOpt.quality as
            | 'standard'
            | 'hd'
            | undefined;
          imageGenerateParams.style = imageOpt.style as
            | 'vivid'
            | 'natural'
            | null
            | undefined;
        }
        return OpenAi.images.generate(imageGenerateParams);
      });

    const imageResponses = await Promise.all(imagesToCreatePromises);
    const imageUrls = imageResponses.reduce((acc, obj) => {
      return acc.concat(obj.data[0].url as string);
    }, [] as string[]);

    const imageFiles =
      await chatCompletionService.downloadAndConvertImagesToJpeg(
        imageUrls,
        user.username,
        interactionTag,
      );

    return imageFiles;
  },
};
