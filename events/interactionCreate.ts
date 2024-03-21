import { ChannelType, ChatInputCommandInteraction, Collection, Events, ModalSubmitInteraction, TextBasedChannel, TextChannel } from "discord.js";
import { Command, optInCommands, singleInstanceCommandsEnum } from "../shared/discord-js-types";
import { config } from "../config";
import usersDao from "../database/users/usersDao";
import modalsService from "../modals/modals.service";
import { MAX_USER_SINGLE_INSTANCE_COMMANDS } from "../shared/constants";

const createInteractionEvent: Command = {
	name: Events.InteractionCreate,
	async execute(interaction: ChatInputCommandInteraction | ModalSubmitInteraction ) {
		const { cooldowns, singleInstanceCommands, singleInstanceMessageCollector } = interaction.client;
		const { user, commandName } = interaction as ChatInputCommandInteraction;
		const command = interaction.client.commands.get(commandName) as Command;
		const channel = interaction.channel as TextChannel | TextBasedChannel;

		const isInteractionInDirectMessage = channel?.type === ChannelType.DM;
		
		if (!cooldowns.has(command?.data?.name)) {
			cooldowns.set(command?.data?.name, new Collection());
		}

		// Checking to see if the command is an opt in command AND the user has opted in
		// to utilize the command
		if (config.commands.optInCommands.includes(commandName as optInCommands)) {
			const userOptInRecord = await usersDao.getUserOptIn(user.id);
			const { optIn } = userOptInRecord;
			if (!optIn) {
				return interaction.reply({
					content: `You do not have access to this command. Only users opted into sharing data can use this command.`,
					ephemeral: true,
				});
			}
		}

		// This is the logic for handling single instance commands in discord. Single Instance commands can only have ONE active instance per channel.
		// This logic is set to be applied to directMessage and non direct message channels.
		if (config.commands.singleInstanceCommands.includes(commandName as singleInstanceCommandsEnum)) {
			
			// Checking to see if the maximum amount of single instance commands per user has been reached.
			if (singleInstanceCommands.size === MAX_USER_SINGLE_INSTANCE_COMMANDS) {
				return interaction.reply({
					content: `:exclamation: The maximum amount of generative services has been reached at this time. Please wait for user(s) to end their sessions.`,
					ephemeral: true,
				});
			}

			// If a user initiated a chat with the bot the interaction will be cancelled
			const userMessageCollector = singleInstanceMessageCollector.get(interaction.user.id);
			if (userMessageCollector) {
				const channelName = interaction.client.channels.cache.get(userMessageCollector.channelId);
				return interaction.reply({
					content: `Sorry you already have an active chat initiated in **${channelName}** channel.`,
					ephemeral: true,
				});
			}

			// Findind all initiated user single instance commands
			const userSingleInstanceCommands = singleInstanceCommands.filter((colCommand) => {
				return colCommand.userId === interaction.user.id;
			});

			// Finding if the user has already initiated a single instance command in the current channel.
			const activeCommand = userSingleInstanceCommands.find(usrCommand => usrCommand.channelId === interaction.channelId);

			if (activeCommand) {
				return interaction.reply(
					{ 
						content: `You have a single instance command active in this channel. Please terminate the active command to execute: **${commandName}**.`,
						ephemeral: true
					});
			} else {
				singleInstanceCommands.set(
					interaction.id, { 
						channelType: interaction.channel?.type, 
						channelId: interaction.channel?.id, 
						channelName: isInteractionInDirectMessage ? null : channel.name, 
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

		if (timestamps.has(interaction.user.id)) {
			const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

			if (now < expirationTime) {
				const expiredTimestamp = Math.round(expirationTime / 1000);
				return interaction.reply({ content: `Please wait, you are on a cooldown for \`${command?.data?.name}\`. You can use it again <t:${expiredTimestamp}:R>.`, ephemeral: true });
			}

			timestamps.set(interaction.user.id, now);
			setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
		}

		if (!interaction.isChatInputCommand()) return;

		if (!command) {
			console.error(`No command matching ${commandName} was found.`);
			return;
		}

		try {
			await command.execute(interaction);
		} catch (_err) {
			interaction.client.singleInstanceCommands.delete(interaction.id);
			console.error(`Error executing ${commandName}`);
			console.error(_err);
			return interaction.reply(
				{
					content: `There was an internal error executing the command ${commandName}.`,
					ephemeral: true,
				}
			);
		}
	},
};

export = createInteractionEvent;