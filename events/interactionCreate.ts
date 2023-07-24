import { ChannelType, Collection, CommandInteraction, DMChannel, Events, TextBasedChannel, TextChannel } from "discord.js";
import { Command } from "../shared/discord-js-types";
import { config } from "../config";

const createInteractionEvent: Command = {
	name: Events.InteractionCreate,
	async execute(interaction: CommandInteraction) {
		const { cooldowns, singleInstanceCommands } = interaction.client;
		const command = interaction.client.commands.get(interaction.commandName) as Command;
		const { user, commandName } = interaction;
		const channel = interaction.channel as TextChannel | TextBasedChannel;

		const isInteractionInDirectMessage = channel?.type === ChannelType.DM;
		const userName = user.username;
		
		if (!cooldowns.has(command?.data?.name)) {
			cooldowns.set(command?.data?.name, new Collection());
		}

		// This is the logic for handling single instance commands in discord. Single Instance commands can only have ONE active instance per channel.
		// This logic is set to be applied to directMessage and non direct message channels.
		if (config.commands.singleInstanceCommands.includes(commandName)) {
			const commandMatch = isInteractionInDirectMessage ?
				singleInstanceCommands.find((singleInstanceCommand) => 
					singleInstanceCommand.name === commandName && singleInstanceCommand.user === userName && singleInstanceCommand.channelType === ChannelType.DM) :
				singleInstanceCommands.find((singleInstanceCommand) => 
					singleInstanceCommand.name === commandName && singleInstanceCommand.channelName === channel.name);

			if (commandMatch) {
				return interaction.reply(`Command already initiated. Only one active instance of the command **${command.data?.name}** can exist at a time.`);
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
		const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1000;

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
			console.error(`Error executing ${commandName}`);
			console.error(_err);
		}
	},
};

export = createInteractionEvent;