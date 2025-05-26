import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  User,
} from 'discord.js';
import { imageModelConfigOptions, imageModelEnums } from '../../config';
import { ImageGenerateParams, ImagesResponse } from 'openai/resources';
import { OpenAi } from '../..';
import { TEMP_FOLDER_PATH } from '../../shared/constants';
import * as fs from 'fs';

export interface GenerateImageOptions {
  prompt: string;
  model: imageModelEnums;
  background?: string;
  n?: number;
  output_format?: string;
  quality?: string;
  size?: string;
  style?: string;
  moderation?: string;
  response_format?: string;
}

export default {
  generateImageSizeSelection(imageModel: imageModelEnums) {
    const imageSizesToDisplay = imageModelConfigOptions[imageModel].size;

    const buttons = imageSizesToDisplay.map((size) => {
      return new ButtonBuilder()
        .setCustomId(size)
        .setLabel(size)
        .setStyle(ButtonStyle.Primary);
    });

    const row = new ActionRowBuilder().addComponents(buttons);

    return row;
  },

  generateImageSelectionOptions(imageModel: imageModelEnums) {
    const imageSelectionOptions = [];
    const imageSettingOptions = imageModelConfigOptions[imageModel];
    for (const [key, value] of Object.entries(imageSettingOptions)) {
      const buttons = value.map((option) => {
        return new ButtonBuilder()
          .setCustomId(option)
          .setLabel(option)
          .setStyle(ButtonStyle.Primary);
      });
      const row = new ActionRowBuilder().addComponents(buttons);
      imageSelectionOptions.push({
        name: key,
        row,
      });
    }
    return imageSelectionOptions;
  },

  validateImageCreationOptions(imageOptions: GenerateImageOptions) {
    return (
      typeof imageOptions.prompt === 'string' &&
      typeof imageOptions.quality === 'string' &&
      typeof imageOptions.style === 'string' &&
      typeof imageOptions.n === 'number' &&
      typeof imageOptions.size === 'string' &&
      typeof imageOptions.model === 'string'
    );
  },

  async generateImages(
    user: User,
    imageOptions: GenerateImageOptions,
    interactionTag: number,
  ) {
    const model = imageOptions.model;
    // Setting the response format for the image generation request
    // By default we use b64_json format for all models except GPT Image 1
    model !== imageModelEnums.GPT_IMAGE_1
      ? (imageOptions.response_format = 'b64_json')
      : null;
    // If the model is DALL-E 3, we need to perform multiple requests since it supports only one image per request
    // otherwise we can generate multiple images in a single request
    const promisesToCreate =
      model === imageModelEnums.DALLE3 ? imageOptions.n : 1;
    const imagesToCreatePromises = Array(promisesToCreate)
      .fill(imageOptions)
      .map((imageOpt: GenerateImageOptions) => {
        if (model === imageModelEnums.DALLE3) {
          imageOpt.n = 1;
        }
        if (model === imageModelEnums.GPT_IMAGE_1) {
          imageOpt.moderation = 'low';
        }
        return OpenAi.images.generate(imageOpt as ImageGenerateParams);
      });

    const imageResponses = await Promise.all(imagesToCreatePromises);
    const imageData = imageResponses.reduce((acc, obj) => {
      return acc.concat(obj.data.map((image) => image.b64_json as string));
    }, [] as string[]);

    const imageFiles = this.convertImageDataToFiles(
      imageData,
      user.username,
      interactionTag,
      model === imageModelEnums.GPT_IMAGE_1
        ? (imageOptions.output_format ?? 'jpeg')
        : 'jpeg',
    );

    return imageFiles;
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

  convertImageDataToFiles(
    imageData: string[],
    username: string,
    interactionTag: number,
    fileExtension: string,
  ) {
    const imageFiles: string[] = [];
    for (let i = 0; i < imageData.length; i++) {
      const imageFilePath = `${TEMP_FOLDER_PATH}/${username}-${interactionTag}-${i + 1}.${fileExtension}`;
      fs.writeFileSync(imageFilePath, Buffer.from(imageData[i], 'base64'));
      imageFiles.push(imageFilePath);
    }
    return imageFiles;
  },
};
