import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../../shared/discord-js-types';

const userInfoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('bot_info')
    .setDescription('Provides information about the server bot'),
  async execute(interaction: ChatInputCommandInteraction) {
    const filteredCommands = interaction.client.commands.filter((command) => {
      return command.data.default_member_permissions !== '8';
    });

    const funCommands = [];
    const generativeCommands = [];
    const utilityCommands = [];

    for (const [, command] of filteredCommands) {
      const { name, description } = command.data;
      const commandInfo = `**/${name}** - ${description}`;

      switch (command.category) {
        case 'fun':
          funCommands.push(commandInfo);
          break;
        case 'generative':
          generativeCommands.push(commandInfo);
          break;
        case 'utility':
          utilityCommands.push(commandInfo);
          break;
        default:
          utilityCommands.push(commandInfo);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('🤖 Boop Bot Information')
      .setDescription(
        'A feature-rich Discord bot with AI-powered generative features, utility commands, and fun interactions.',
      )
      .setColor(0x5865f2)
      .addFields(
        {
          name: '🎉 Fun Commands',
          value:
            funCommands.length > 0
              ? funCommands.join('\n')
              : 'No fun commands available',
          inline: false,
        },
        {
          name: '🤖 AI-Powered Commands',
          value:
            generativeCommands.length > 0
              ? generativeCommands.join('\n')
              : 'No generative commands available',
          inline: false,
        },
        {
          name: '🛠️ Utility Commands',
          value:
            utilityCommands.length > 0
              ? utilityCommands.join('\n')
              : 'No utility commands available',
          inline: false,
        },
      )
      .setFooter({ text: 'Built with TypeScript and Discord.js' })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export = userInfoCommand;
