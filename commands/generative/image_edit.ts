import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Command } from '../../shared/discord-js-types';
import {
  createTempFile,
  deleteTempFilesByName,
  deleteTempFilesByTag,
  generateInteractionTag,
  getRemoteFileBufferData,
  validateImage,
} from '../../shared/utils';
import { OpenAi } from '../..';
import * as fs from 'fs';
import { TEMP_FOLDER_PATH } from '../../shared/constants';
import imagesService, { EditImageOptions } from '../../openAIClient/images/images.service';
import { InteractionTimeOutError } from '../../shared/errors';
import { imageModelEnums } from '../../config';
import { toFile } from 'openai';

const aiImageEditCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('image_edit')
    .setDescription('Upload a .png image file to edit')
    .addAttachmentOption(image =>
      image
        .setName('image_file')
        .setRequired(true)
        .setDescription('Provide a square .png image file'),
    )
    .addStringOption(strOption =>
      strOption
        .setName('model')
        .setDescription('The AI model to generate the image')
        .setRequired(true)
        .addChoices(
          {
            name: imageModelEnums.GPT_IMAGE_1_MINI,
            value: imageModelEnums.GPT_IMAGE_1_MINI,
          },
          {
            name: imageModelEnums.GPT_IMAGE_1_5,
            value: imageModelEnums.GPT_IMAGE_1_5,
          },
        ),
    )
    .addStringOption(strOption =>
      strOption
        .setName('edit_description')
        .setDescription('Describe the edit(s) you would like to make')
        .setRequired(true),
    )
    .addIntegerOption(intOption =>
      intOption
        .setName('image_count')
        .setDescription('The amount of image edits to generate')
        .addChoices(
          { name: '1', value: 1 },
          { name: '2', value: 2 },
          { name: '3', value: 3 },
          { name: '4', value: 4 },
        )
        .setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const interactionTag = generateInteractionTag();
    const username = interaction.user.username;
    const model = interaction.options.getString('model', true) as imageModelEnums;
    const n = interaction.options.getInteger('image_count', true);
    const imageAttachment = interaction.options.getAttachment('image_file', true);
    const prompt = interaction.options.getString('edit_description', true);
    const tempImageName = `${interaction.id}-${imageAttachment.name}`;

    const imageEditOptions: EditImageOptions = {
      prompt,
      model,
      n,
    };
    let imageSettingsSelectionCompleted = false;
    const imageSelectionOptions = imagesService.generateImageSelectionOptions(
      model as imageModelEnums,
      'edit',
    );

    while (!imageSettingsSelectionCompleted) {
      for (const imageOption of imageSelectionOptions) {
        const optionIndex = imageSelectionOptions.indexOf(imageOption);
        const { name, row } = imageOption;
        const settingResponse =
          imageSelectionOptions.indexOf(imageOption) === 0
            ? await interaction.reply({
                content: name,
                components: [row as any],
                flags: MessageFlags.Ephemeral,
              })
            : await interaction.editReply({
                content: name,
                components: [row as any],
              });
        const imageOptionSelected = await settingResponse
          .awaitMessageComponent({
            time: 60000,
          })
          .catch(() => {
            throw new InteractionTimeOutError({
              error: `:warning: Image edits cancelled. Image option selection timeout reached.`,
            });
          });
        await imageOptionSelected.update({ components: [] });
        (imageEditOptions as any)[name] = imageOptionSelected.customId;

        // If this is the last image option, set the flag to true
        if (optionIndex === imageSelectionOptions.length - 1) {
          imageSettingsSelectionCompleted = true;
          await interaction.editReply({
            content: `Options selected: ${JSON.stringify(imageEditOptions)}`,
            components: [],
          });
        }
      }
    }

    await interaction.editReply({
      content: `Hi ${username}, I'm currently processing your image edit request :art:...`,
      components: [],
    });

    try {
      validateImage(imageAttachment);
      const imageBufferData = await getRemoteFileBufferData(imageAttachment.url);
      const tempImagePath = createTempFile(imageBufferData, tempImageName);
      await OpenAi.images
        .edit({
          ...(imageEditOptions as any),
          image: await toFile(fs.createReadStream(tempImagePath) as any, null, {
            type: 'image/png',
          }),
        })
        .then(async completion => {
          const imageData = completion?.data?.map(image => image.b64_json) as string[];
          imagesService.convertImageDataToFiles(imageData, username, interactionTag, 'jpeg');
          let imageFiles = fs.readdirSync(TEMP_FOLDER_PATH);
          imageFiles = imageFiles
            .filter(
              fileName =>
                fileName.includes(username) && fileName.includes(interactionTag.toString()),
            )
            .map(fileName => `${TEMP_FOLDER_PATH}/${fileName}`);
          deleteTempFilesByName([tempImageName]);
          await interaction.followUp({
            content: `Here are your image edits ${username} :blush:`,
            files: imageFiles,
          });
          deleteTempFilesByTag(interactionTag);
        });
    } catch (err: any) {
      if (err?.code !== 'InteractionCollectorError') {
        const errorMessage = err?.errorData?.error;
        console.error(err);
        await interaction.editReply(
          errorMessage || `Sorry there was an issue creating an image variation :disappointed:`,
        );
      }
      deleteTempFilesByName([tempImageName]);
      deleteTempFilesByTag(interactionTag);
    }
  },
};

export = aiImageEditCommand;
