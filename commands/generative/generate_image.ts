import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../../shared/discord-js-types';
import { imageModelEnums } from '../../config';
import {
  deleteTempFilesByTag,
  generateInteractionTag,
} from '../../shared/utils';
import imagesService, {
  GenerateImageOptions,
} from '../../openAIClient/images/images.service';
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
          {
            name: imageModelEnums.GPT_IMAGE_1,
            value: imageModelEnums.GPT_IMAGE_1,
          },
        ),
    )
    .addIntegerOption((intOption) =>
      intOption
        .setName('image_count')
        .setRequired(true)
        .setDescription(`The amount of images to generate`)
        .addChoices(
          { name: '1', value: 1 },
          { name: '2', value: 2 },
          { name: '3', value: 3 },
          { name: '4', value: 4 },
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const interactionTag = generateInteractionTag();
    const user = interaction.user;
    const { username } = user;
    const n = interaction.options.getInteger('image_count', true);
    const prompt = interaction.options
      .getString('description', true)
      .toLowerCase();
    const model = interaction.options.getString(
      'model',
      true,
    ) as imageModelEnums;
    const imageGenerationOptions: GenerateImageOptions = {
      prompt,
      model,
      n,
    };
    let imageSettingsSelectionCompleted = false;
    const imageSelectionOptions = imagesService.generateImageSelectionOptions(
      model as imageModelEnums,
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
                // flags: MessageFlags.Ephemeral,
              });
        const imageOptionSelected = await settingResponse
          .awaitMessageComponent({
            time: 60000,
          })
          .catch(() => {
            throw new InteractionTimeOutError({
              error: `:warning: Image generation cancelled. Image selection timeout reached.`,
            });
          });
        await imageOptionSelected.update({ components: [] });
        (imageGenerationOptions as any)[name] = imageOptionSelected.customId;

        // If this is the last image option, set the flag to true
        if (optionIndex === imageSelectionOptions.length - 1) {
          imageSettingsSelectionCompleted = true;
          await interaction.editReply({
            content: `Options selected: ${JSON.stringify(imageGenerationOptions)}`,
            components: [],
          });
        }
      }
    }

    await interaction.followUp({
      content: `${username} asked for an image, so I'm working on it :art:...`,
      components: [],
      flags: MessageFlags.Ephemeral,
    });
    try {
      const imageFiles = await imagesService.generateImages(
        user,
        imageGenerationOptions,
        interactionTag,
      );
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
    } catch (err: any) {
      if (err?.code !== 'InteractionCollectorError') {
        console.error(err);
        await interaction.editReply({
          content: `Sorry ${username}, I ran into an error attempting to create your 
                  image! Please check to ensure your question is not offensive and doesn't relate to any known 
                  people :sweat_smile:.`,
          components: [],
        });
        await interaction.followUp({
          content: `What you told me to create: ${prompt}`,
          flags: MessageFlags.Ephemeral,
        });
      }
      deleteTempFilesByTag(interactionTag);
    }
  },
};

export = aiImageGenerateCommand;
