import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, User } from 'discord.js';
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

export interface ToolCallGenerateImageOptions {
  prompt: string;
  model: imageModelEnums;
  n?: number;
  dalle3Size?: string;
  gptImage1Size?: string;
  dalle3Quality?: string;
  gptImage1Quality?: string;
  style?: string;
}

export interface ToolCallEditImageOptions {
  prompt: string;
  model: imageModelEnums;
  n?: number;
  dalle2Size?: string;
  gptImage1Size?: string;
  gptImage1Quality?: string;
  gptImage1Background?: string;
}

export interface EditImageOptions {
  prompt: string;
  image?: string;
  model?: imageModelEnums;
  n?: number;
  size?: string;
  background?: string;
  response_format?: string;
  quality?: string;
}

export default {
  generateImageSizeSelection(imageModel: imageModelEnums) {
    const imageSizesToDisplay = imageModelConfigOptions[imageModel].imageGeneration.size;

    const buttons = imageSizesToDisplay.map(size => {
      return new ButtonBuilder().setCustomId(size).setLabel(size).setStyle(ButtonStyle.Primary);
    });

    const row = new ActionRowBuilder().addComponents(buttons);

    return row;
  },

  generateImageSelectionOptions(imageModel: imageModelEnums, action: 'generate' | 'edit') {
    const imageSelectionOptions = [];
    const imageSettingOptions = imageModelConfigOptions[imageModel];
    for (const [key, value] of Object.entries(
      action === 'generate' ? imageSettingOptions.imageGeneration : imageSettingOptions.imageEdit,
    )) {
      if (Array.isArray(value)) {
        const buttons = value.map(option => {
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
    }
    return imageSelectionOptions;
  },

  validateImageCreationOptions(imageOptions: ToolCallGenerateImageOptions) {
    if (!imageOptions?.model || typeof imageOptions.model !== 'string') {
      return false;
    }
    if (!imageOptions?.prompt || typeof imageOptions.prompt !== 'string') {
      return false;
    }
    if (!imageOptions?.n && typeof imageOptions.n !== 'string') {
      return false;
    }
    if (!imageOptions?.style && typeof imageOptions.style !== 'string') {
      return false;
    }
    if (
      !imageOptions?.dalle3Size &&
      !imageOptions?.gptImage1Size &&
      typeof imageOptions.dalle3Size !== 'string' &&
      typeof imageOptions.gptImage1Size !== 'string'
    ) {
      return false;
    }
    if (
      !imageOptions?.dalle3Quality &&
      !imageOptions?.gptImage1Quality &&
      typeof imageOptions.dalle3Quality !== 'string' &&
      typeof imageOptions.gptImage1Quality !== 'string'
    ) {
      return false;
    }
    // If all checks pass, return true
    return true;
  },

  validateImageEditOptions(imageOptions: ToolCallEditImageOptions) {
    if (!imageOptions?.model || typeof imageOptions.model !== 'string') {
      return false;
    }
    if (!imageOptions?.prompt || typeof imageOptions.prompt !== 'string') {
      return false;
    }
    if (!imageOptions?.n && typeof imageOptions.n !== 'string') {
      return false;
    }
    if (
      !imageOptions?.dalle2Size &&
      !imageOptions?.gptImage1Size &&
      typeof imageOptions.dalle2Size !== 'string' &&
      typeof imageOptions.gptImage1Size !== 'string'
    ) {
      return false;
    }
    if (
      imageOptions.model === imageModelEnums.GPT_IMAGE_1 &&
      (!imageOptions?.gptImage1Quality || typeof imageOptions.gptImage1Quality !== 'string')
    ) {
      return false;
    }
    if (
      imageOptions.model === imageModelEnums.GPT_IMAGE_1 &&
      (!imageOptions?.gptImage1Background || typeof imageOptions.gptImage1Background !== 'string')
    ) {
      return false;
    }
    return true;
  },

  translateToolCallImageOptionsToGenerateImageOptions(
    toolCallImageOptions: ToolCallGenerateImageOptions,
  ) {
    return {
      model: toolCallImageOptions.model,
      prompt: toolCallImageOptions.prompt,
      n: Number(toolCallImageOptions.n),
      size:
        toolCallImageOptions.model === imageModelEnums.DALLE3
          ? toolCallImageOptions.dalle3Size
          : toolCallImageOptions.gptImage1Size,
      quality:
        toolCallImageOptions.model === imageModelEnums.DALLE3
          ? toolCallImageOptions.dalle3Quality
          : toolCallImageOptions.gptImage1Quality,
      ...(toolCallImageOptions.model === imageModelEnums.DALLE3 && {
        style: toolCallImageOptions.style,
      }),
    };
  },

  translateToolCallImageOptionsToEditImageOptions(toolCallImageOptions: ToolCallEditImageOptions) {
    return {
      model: toolCallImageOptions.model,
      prompt: toolCallImageOptions.prompt,
      n: Number(toolCallImageOptions.n),
      size:
        toolCallImageOptions.model === imageModelEnums.DALLE2
          ? toolCallImageOptions.dalle2Size
          : toolCallImageOptions.gptImage1Size,
      ...(toolCallImageOptions.model === imageModelEnums.GPT_IMAGE_1 && {
        quality: toolCallImageOptions.gptImage1Quality,
        background: toolCallImageOptions.gptImage1Background,
      }),
    };
  },

  async generateImages(user: User, imageOptions: GenerateImageOptions, interactionTag: number) {
    const model = imageOptions.model;
    // Setting the response format for the image generation request
    // By default we use b64_json format for all models except GPT Image 1
    model !== imageModelEnums.GPT_IMAGE_1 ? (imageOptions.response_format = 'b64_json') : null;
    // If the model is DALL-E 3, we need to perform multiple requests since it supports only one image per request
    // otherwise we can generate multiple images in a single request
    const promisesToCreate = model === imageModelEnums.DALLE3 ? imageOptions.n : 1;
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
      if (obj.data) {
        return acc.concat(obj.data.map(image => image.b64_json as string));
      }
      return acc;
    }, [] as string[]);

    const imageFiles = this.convertImageDataToFiles(
      imageData,
      user.username,
      interactionTag,
      model === imageModelEnums.GPT_IMAGE_1 ? (imageOptions.output_format ?? 'jpeg') : 'jpeg',
    );

    return imageFiles;
  },

  async editImages(
    user: User,
    imageOptions: EditImageOptions,
    imageBuffer: Buffer,
    interactionTag: number,
  ) {
    const model = imageOptions.model;
    model !== imageModelEnums.GPT_IMAGE_1 ? (imageOptions.response_format = 'b64_json') : null;

    const { toFile } = await import('openai');
    const imageFile = await toFile(imageBuffer, 'image.png', { type: 'image/png' });

    const imageResponse = await OpenAi.images.edit({
      ...imageOptions,
      image: imageFile,
    } as any);

    const imageData = (imageResponse.data?.map(image => image.b64_json) as string[]) || [];
    const imageFiles = this.convertImageDataToFiles(
      imageData,
      user.username,
      interactionTag,
      'jpeg',
    );

    return imageFiles;
  },

  generateImageEmbeds(generatedImages: ImagesResponse, username: string) {
    const data = generatedImages.data ?? [];
    const embeds = data.map(image => {
      const imageUrl = image?.url as string;
      return new EmbedBuilder().setURL(imageUrl).setImage(imageUrl);
    });

    if (embeds.length > 0) {
      const title = `${username}'s image(s)`;
      embeds[0].setTitle(title);
    }

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
