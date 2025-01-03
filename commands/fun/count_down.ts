import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandIntegerOption,
} from 'discord.js';
import { Command } from '../../shared/discord-js-types';

const countDownCommand: Command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('count_down')
    .setDescription('Start a count down!')
    .addIntegerOption((countStart: SlashCommandIntegerOption) =>
      countStart
        .setName('count')
        .setDescription('Count down timer starting value')
        .setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    let count = interaction.options.getInteger('count', true);
    const countDownResponse = await interaction.reply(`Beginning Countdown!`);

    const intervalId = setInterval(async () => {
      await interaction.editReply(`${count}!`);
      count--;
      if (count === -1) {
        await countDownResponse.delete();
        await interaction.followUp(`Ta da :confetti_ball:!`);
        clearInterval(intervalId);
      }
    }, 1000);
  },
};

export = countDownCommand;
