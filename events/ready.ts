import { Client, Events } from 'discord.js';
import { Command } from '../shared/discord-js-types';
import { config } from '../config';

const clientReadyEvent: Command = {
  name: Events.ClientReady,
  once: true,
  execute(client: Client) {
    config.botId = client.user?.id as string;
    console.log(`Ready! Logged in as ${client?.user?.tag}`);
  },
};

export = clientReadyEvent;
