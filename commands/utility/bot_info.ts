import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../../shared/discord-js-types';

const userInfoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('bot_info')
    .setDescription('Provides information about the server bot'),
  async execute(interaction: ChatInputCommandInteraction) {
    let botInfoMsg = `
Here are the following commands available for use:\n
`;
    // filtering out commands with administrator permissions set.
    const filteredCommands = interaction.client.commands.filter((command) => {
      if (command.data.default_member_permissions !== '8') {
        return command;
      }
    });

    for (const command of filteredCommands) {
      const { name, description } = command[1].data;
      botInfoMsg += `[commandName]: ${name} - [description]: ${description}\n`;
    }

    await interaction.reply({
      content: botInfoMsg,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export = userInfoCommand;
