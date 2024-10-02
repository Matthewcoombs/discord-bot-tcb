import {
  ChatInputCommandInteraction,
  CollectedInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../../shared/discord-js-types';
import { OpenAi } from '../..';
import chatCompletionService from '../../openAIClient/chatCompletion/chatCompletion.service';
import { TEMP_FOLDER_PATH } from '../../shared/constants';
import * as fs from 'fs';
import { imageModelEnums } from '../../config';
import { ImageGenerateParams, ImagesResponse } from 'openai/resources';
import {
  deleteTempFilesByTag,
  generateInteractionTag,
} from '../../shared/utils';
import imagesService from '../../openAIClient/images/images.service';
import { InteractionTimeOutError } from '../../shared/errors';

const aiImageGenerateCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('generate_image')
    .setDescription('Generate images')
    .addStringOption((strOption) =>
      strOption
        .setName('description')
        .setDescription('Describe the image you want generated')
        .setRequired(true),
    )
    .addStringOption((strOption) =>
      strOption
        .setName('model')
        .setDescription('The AI model to generate the image')
        .setRequired(true)
        .addChoices(
          {
            name: imageModelEnums.DALLE2,
            value: imageModelEnums.DALLE2,
          },
          {
            name: imageModelEnums.DALLE3,
            value: imageModelEnums.DALLE3,
          },
        ),
    )
    .addStringOption((strOption) =>
      strOption
        .setName('quality')
        .setDescription(
          `The quality of image to generate (hd is only supported with ${imageModelEnums.DALLE3})`,
        )
        .addChoices(
          {
            name: 'standard',
            value: 'standard',
          },
          {
            name: 'high definition',
            value: 'hd',
          },
        ),
    )
    .addStringOption((strOption) =>
      strOption
        .setName('style')
        .setDescription(
          `The style of image to generate (style is only supported with ${imageModelEnums.DALLE3})`,
        )
        .addChoices(
          {
            name: 'vivid',
            value: 'vivid',
          },
          {
            name: 'natural',
            value: 'natural',
          },
        ),
    )
    .addIntegerOption((intOption) =>
      intOption
        .setName('image_count')
        .setDescription(
          `The amount of images to generate (multiple images is only supported with ${imageModelEnums.DALLE2})`,
        )
        .addChoices(
          { name: '1', value: 1 },
          { name: '2', value: 2 },
          { name: '3', value: 3 },
          { name: '4', value: 4 },
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const interactionTag = generateInteractionTag();
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const description = await interaction.options
      .getString('description', true)
      .toLowerCase();
    const model = await interaction.options.getString('model', true);
    let quality = (await interaction.options.getString('quality')) as
      | 'standard'
      | 'hd';
    quality = quality ? quality : 'standard';
    let style = (await interaction.options.getString('style')) as
      | 'vivid'
      | 'natural';
    style = style ? style : 'vivid';
    let imageCount = await interaction.options.getInteger('image_count', false);
    imageCount = imageCount ? imageCount : 1;

    // prompting the user for their desired image size(s) based on the image model selected
    const actionRowComponent = imagesService.generateImageSizeSelection(
      model as imageModelEnums,
    );
    const sizeResponse = await interaction.reply({
      content: `Select a size for your image(s)`,
      components: [actionRowComponent as any],
      ephemeral: true,
    });

    const collectorFilter = (message: CollectedInteraction) => {
      return message?.user?.id === userId;
    };
    const imageSizeSelected = await sizeResponse
      .awaitMessageComponent({
        filter: collectorFilter,
        time: 60000,
      })
      .catch(() => {
        sizeResponse.delete();
        throw new InteractionTimeOutError({
          error: `:warning: Image generation cancelled. Image size selection timeout reached.`,
        });
      });

    const size = imageSizeSelected.customId;

    // checking the model value provided to determine the payload sent to the openAI API
    let openAIBody: ImageGenerateParams = {
      model,
      prompt: description,
      size: size as any,
    };

    switch (model) {
      case imageModelEnums.DALLE2:
        openAIBody = {
          ...openAIBody,
          n: imageCount,
        };
        break;
      case imageModelEnums.DALLE3:
        openAIBody = {
          ...openAIBody,
          n: 1,
          quality,
          style,
        };
        break;
    }

    await interaction.editReply({
      content: `${username} asked for an image, so I'm working on it :art:...`,
      components: [],
    });
    try {
      const isDalle3 = openAIBody.model === 'dall-e-3';
      let imageUrls: string[];
      if (isDalle3) {
        const versionedOpenAiBodys: ImageGenerateParams[] =
          Array(imageCount).fill(openAIBody);
        versionedOpenAiBodys.forEach(
          (body) => (body.prompt = `${body.prompt} - version 1`),
        );
        const imageCreationPromises = versionedOpenAiBodys.map((body) => {
          return OpenAi.images.generate(body);
        });
        const imageCompletions: ImagesResponse[] = await Promise.all(
          imageCreationPromises,
        );
        imageUrls = imageCompletions.reduce((acc, obj) => {
          return acc.concat(obj.data[0].url as string);
        }, [] as string[]);
      } else {
        const imageCompletion = await OpenAi.images.generate(openAIBody);
        imageUrls = imageCompletion.data.map((image) => image.url as string);
      }

      await chatCompletionService.downloadAndConvertImagesToJpeg(
        imageUrls,
        username,
        interactionTag,
      );
      let imageFiles = fs.readdirSync(TEMP_FOLDER_PATH);
      imageFiles = imageFiles
        .filter(
          (fileName) =>
            fileName.includes(username) &&
            fileName.includes(interactionTag.toString()),
        )
        .map((fileName) => `${TEMP_FOLDER_PATH}/${fileName}`);

      const finalResponseMsg =
        imageFiles.length > 1
          ? `Here are your requested images ${username} :blush:`
          : `Here is your requested image ${username} :blush:`;

      await interaction.followUp({
        content: finalResponseMsg,
        components: [],
        files: imageFiles,
      });
      deleteTempFilesByTag(interactionTag);
    } catch (err) {
      console.error(err);
      deleteTempFilesByTag(interactionTag);
      await interaction.editReply({
        content: `Sorry ${username}, I ran into an error attempting to create your 
                image! Please check to ensure your question is not offensive and doesn't relate to any known 
                people :sweat_smile:.`,
        components: [],
      });
      await interaction.followUp({
        content: `What you told me to create: ${description}`,
        ephemeral: true,
      });
    }
  },
};

export = aiImageGenerateCommand;
