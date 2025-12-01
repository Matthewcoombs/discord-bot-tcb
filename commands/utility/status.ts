import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../../shared/discord-js-types';
import { Anthropic, pg, OpenAi } from '../../index';

const startTime = Date.now();

async function checkAPIStatus(name: string, checkFn: () => Promise<boolean>): Promise<string> {
  try {
    const isHealthy = await checkFn();
    return isHealthy ? '🟢 Online' : '🟡 Degraded';
  } catch {
    return '🔴 Offline';
  }
}

const statusCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Shows bot status, uptime, and API health')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction: ChatInputCommandInteraction) {
    const uptime = Date.now() - startTime;
    const days = Math.floor(uptime / 86400000);
    const hours = Math.floor((uptime % 86400000) / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);

    const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    const memUsage = process.memoryUsage();
    const memUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
    const memTotalMB = (memUsage.heapTotal / 1024 / 1024).toFixed(2);

    const [openaiStatus, anthropicStatus, dbStatus] = await Promise.all([
      checkAPIStatus('OpenAI', async () => {
        await OpenAi.models.list();
        return true;
      }),
      checkAPIStatus('Anthropic', () => {
        return Promise.resolve(!!Anthropic);
      }),
      checkAPIStatus('Database', async () => {
        await pg.query('SELECT 1');
        return true;
      }),
    ]);

    const embed = new EmbedBuilder()
      .setTitle('🤖 Bot Status')
      .setColor(0x5865f2)
      .addFields(
        { name: '⏱️ Uptime', value: uptimeStr, inline: true },
        { name: '💾 Memory', value: `${memUsedMB}MB / ${memTotalMB}MB`, inline: true },
        { name: '📊 Servers', value: `${interaction.client.guilds.cache.size}`, inline: true },
        { name: '🤖 OpenAI', value: openaiStatus, inline: true },
        { name: '🧠 Anthropic', value: anthropicStatus, inline: true },
        { name: '🗄️ Database', value: dbStatus, inline: true },
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export = statusCommand;
