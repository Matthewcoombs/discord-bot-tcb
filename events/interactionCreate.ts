import {
  ChannelType,
  ChatInputCommandInteraction,
  Collection,
  Events,
  InteractionReplyOptions,
  MessageFlags,
  ModalSubmitInteraction,
} from 'discord.js';
import { Command, optInCommands, singleInstanceCommandsEnum } from '../shared/discord-js-types';
import { config } from '../config';
import usersDao from '../database/users/usersDao';
import modalsService from '../modals/modals.service';

const createInteractionEvent: Command = {
  name: Events.InteractionCreate,
  async execute(interaction: ChatInputCommandInteraction) {
    const { cooldowns, singleInstanceCommands, chatInstanceCollector } = interaction.client;
    const { user, commandName, channel, channelId } = interaction;
    const command = interaction.client.commands.get(commandName) as Command;

    const isOptInCommand = config.commands.optInCommands.includes(commandName as optInCommands);
    const isSingleInstanceCommand = config.commands.singleInstanceCommands.includes(
      commandName as singleInstanceCommandsEnum,
    );
    const isInteractionInDirectMessage = channel?.type === ChannelType.DM;

    if (!cooldowns.has(command?.data?.name && commandName)) {
      cooldowns.set(command?.data?.name, new Collection());
    }

    // Checking to see if the command is an opt in command AND the user has opted in
    // to utilize the command
    if (isOptInCommand) {
      const userOptInRecord = await usersDao.getUserOptIn(user.id);
      const { optIn } = userOptInRecord;
      if (!optIn) {
        return interaction.reply({
          content: `You do not have access to this command. Only users opted into sharing data can use this command.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // This is the logic for handling single instance commands in discord. Single Instance commands can only have ONE active instance per channel.
    // This logic is set to be applied to directMessage and non direct message channels.
    if (isSingleInstanceCommand) {
      // Checking to see if the maximum amount of single instance commands per user has been reached.
      if (singleInstanceCommands.size === config.singleInstanceCommandsLimit) {
        return interaction.reply({
          content: `:exclamation: The maximum amount of generative services has been reached at this time. Please wait for user(s) to end their sessions.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // If a user initiated a chat with the bot the interaction will be cancelled
      const userChatInstance = chatInstanceCollector.get(interaction.user.id);
      if (userChatInstance && userChatInstance.channelId === channel?.id) {
        const channelName = interaction.client.channels.cache.get(channelId);
        return interaction.reply({
          content: `Sorry you already have an active chat initiated in **${channelName}** channel.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // Searching for an active command instance in the current channel
      const channelSingleInstanceCommand = singleInstanceCommands.find(colCommand => {
        return (
          colCommand.userId === interaction.user.id &&
          colCommand.channelId === interaction.channelId
        );
      });

      if (channelSingleInstanceCommand) {
        return interaction.reply({
          content: `You have a single instance command active in this channel. Please terminate the active command to execute: **${commandName}**.`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        singleInstanceCommands.set(interaction.id, {
          channelType: interaction.channel?.type,
          channelId: interaction.channel?.id,
          channelName: isInteractionInDirectMessage ? null : (channel?.name as string),
          name: commandName,
          user: interaction.user.username,
          userId: interaction.user.id,
        });
      }
    }

    // handling modal interactions
    if (interaction.isModalSubmit() === true) {
      const response = await modalsService.handleModalSubmit(interaction as ModalSubmitInteraction);
      return response;
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command?.data?.name);
    const defaultCooldownDuration = 3;
    const cooldownAmount = (command?.cooldown ?? defaultCooldownDuration) * 1000;

    if (timestamps.has(interaction.user.id) && commandName) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

      if (now < expirationTime) {
        const expiredTimestamp = Math.round(expirationTime / 1000);
        const cooldownReply = await interaction.reply({
          content: `Please wait, you are on a cooldown for \`${command?.data?.name}\`. You can use it again <t:${expiredTimestamp}:R>.`,
          flags: MessageFlags.Ephemeral,
        });
        setTimeout(() => {
          cooldownReply.delete();
        }, cooldownAmount);
        return;
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => {
      timestamps.delete(interaction.user.id);
    }, cooldownAmount);

    if (!interaction.isChatInputCommand()) return;

    if (!command) {
      console.error(`No command matching ${commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (_err: any) {
      interaction.client.singleInstanceCommands.delete(interaction.id);
      console.error(`Error executing ${commandName}`);
      const errorMsg = _err?.errorData
        ? _err.errorData.error
        : `There was an internal error executing the command \`${commandName}\`.`;

      console.error(_err);
      const errorResponse: InteractionReplyOptions = {
        content: errorMsg,
        flags: MessageFlags.Ephemeral,
      };

      return interaction.replied
        ? interaction.followUp(errorResponse)
        : interaction.reply(errorResponse);
    }
  },
};

export = createInteractionEvent;
