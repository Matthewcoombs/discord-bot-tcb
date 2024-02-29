import { ChannelType, ChatInputCommandInteraction, Collection, Events, ModalSubmitInteraction, TextBasedChannel, TextChannel } from "discord.js";
import { Command, optInCommands, singleInstanceCommandsEnum } from "../shared/discord-js-types";
import { config } from "../config";
import usersDao from "../database/users/usersDao";
import modalsService from "../modals/modals.service";

const createInteractionEvent: Command = {
	name: Events.InteractionCreate,
	async execute(interaction: ChatInputCommandInteraction | ModalSubmitInteraction ) {
		const { cooldowns, singleInstanceCommands } = interaction.client;
		const { user, commandName } = interaction as ChatInputCommandInteraction;
		const command = interaction.client.commands.get(commandName) as Command;
		const channel = interaction.channel as TextChannel | TextBasedChannel;

		const isInteractionInDirectMessage = channel?.type === ChannelType.DM;
		const userName = user.username;
		
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

		// handling modal interactions
		if (interaction.isModalSubmit() === true) {
			const response = await modalsService.handleModalSubmit(interaction as ModalSubmitInteraction);
			return response;
		}

		// This is the logic for handling single instance commands in discord. Single Instance commands can only have ONE active instance per channel.
		// This logic is set to be applied to directMessage and non direct message channels.
		if (config.commands.singleInstanceCommands.includes(commandName as singleInstanceCommandsEnum)) {
			const commandMatch = isInteractionInDirectMessage ?
				singleInstanceCommands.find((singleInstanceCommand) => 
					singleInstanceCommand.name === commandName && singleInstanceCommand.user === userName && singleInstanceCommand.channelType === ChannelType.DM) :
				singleInstanceCommands.find((singleInstanceCommand) => 
					singleInstanceCommand.name === commandName && singleInstanceCommand.channelName === channel.name);

			if (commandMatch) {
				return interaction.reply(
					{ content: `Command already initiated. Only one active instance of the command **${command.data?.name}** can exist at a time.`,
					ephemeral: true});
			} else {
				isInteractionInDirectMessage ? 
				singleInstanceCommands.set(
					interaction.id, { channelType: interaction.channel?.type, channelName: null, name: commandName, user: interaction.user.username}) :
				singleInstanceCommands.set(
					interaction.id, { channelType: interaction.channel?.type, channelName: channel.name, name: commandName, user: interaction.user.username});
				
			}
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