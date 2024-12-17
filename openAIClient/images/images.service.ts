import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  User,
} from 'discord.js';
import { imageModelEnums } from '../../config';
import { ImageGenerateParams, ImagesResponse } from 'openai/resources';
import { OpenAi } from '../..';
import { TEMP_FOLDER_PATH } from '../../shared/constants';
import axios from 'axios';
import * as fs from 'fs';

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

  validateImageCreationOptions(imageOptions: GenerateImageOptions) {
    return (
      typeof imageOptions.description === 'string' &&
      typeof imageOptions.quality === 'string' &&
      typeof imageOptions.style === 'string' &&
      typeof imageOptions.count === 'number' &&
      typeof imageOptions.size === 'string' &&
      typeof imageOptions.model === 'string'
    );
  },

  async generateImages(
    user: User,
    imageOptions: GenerateImageOptions,
    interactionTag: number,
  ) {
    console.log('testing image create options:', imageOptions);

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

    const imageFiles = await this.downloadAndConvertImagesToJpeg(
      imageUrls,
      user.username,
      interactionTag,
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
