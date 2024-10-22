import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CollectedInteraction,
  EmbedBuilder,
  Events,
  Presence,
} from 'discord.js';
import { Command } from '../shared/discord-js-types';
import { generateOptInCopy } from '../shared/constants';
import usersDao from '../database/users/usersDao';

const CONFIRM_ID = 'confirm';
const CANCEL_ID = 'cancel';

const memberAvailableEvent: Command = {
  name: Events.PresenceUpdate,
  async execute(oldPresence: Presence, newPresence: Presence) {
    const oldStatus = oldPresence?.status;
    const newStatus = newPresence?.status;
    const isUserActive = oldStatus !== 'online' && newStatus === 'online';

    if (isUserActive) {
      const { user, userId } = newPresence;
      const userRecord = await usersDao.getUserById(userId);

      // If no user record exists for the available user, we will insert them into the database here
      if (!userRecord && user) {
        const { id: discordId, username } = user;
        await usersDao.addUser({
          discordId,
          username,
        });
      }

      const userOptInData = await usersDao.getUserOptIn(userId);

      // If a user record exists and they have NOT responded to the opt-in question,
      // we will ask the user if they want to opt into data tracking.
      if (!userOptInData && user) {
        const exampleEmbed = new EmbedBuilder()
          .setColor('Grey')
          .setTitle('Boop Data Tracking Opt-In')
          .setURL('https://github.com/Matthewcoombs/discord-bot-tcb')
          .setAuthor({
            name: 'Boop Discord Bot',
            iconURL:
              'https://camo.githubusercontent.com/394da2f904b93a83a020a2f05cd212ea54efba8ccd2c9ac1d499309b3b94abd0/68747470733a2f2f63646e2e646973636f72646170702e636f6d2f62616e6e6572732f313132383030313137393637313038353138392f33633533336236383232646432653731316435653330663139613262313130663f73697a653d353132',
            url: 'https://github.com/Matthewcoombs/discord-bot-tcb',
          })
          .setDescription(generateOptInCopy(user.username))
          .setThumbnail(
            'https://camo.githubusercontent.com/394da2f904b93a83a020a2f05cd212ea54efba8ccd2c9ac1d499309b3b94abd0/68747470733a2f2f63646e2e646973636f72646170702e636f6d2f62616e6e6572732f313132383030313137393637313038353138392f33633533336236383232646432653731316435653330663139613262313130663f73697a653d353132',
          )
          .setTimestamp();

        const confirm = new ButtonBuilder()
          .setCustomId(CONFIRM_ID)
          .setLabel('confirm')
          .setStyle(ButtonStyle.Success);

        const cancel = new ButtonBuilder()
          .setCustomId(CANCEL_ID)
          .setLabel('opt out')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(confirm, cancel);

        const userResponse = await user.send({
          components: [row as any],
          embeds: [exampleEmbed],
        });

        const collectorFilter = (message: CollectedInteraction) => {
          return message?.user?.id === userId;
        };
        try {
          // If the user does not respond in 2 minutes (120000) the optIn Message is deleted, and we will
          // ask again later.
          const optInResponse = (await userResponse?.awaitMessageComponent({
            filter: collectorFilter,
            time: 120000,
          })) as ButtonInteraction;
          const isOptIn = optInResponse.customId === CONFIRM_ID;
          await usersDao.insertUserOptIn(userId, isOptIn);
          await user.send(
            `Thank you for responding to the user data tracking questionnaire.`,
          );
          await user.send(
            `You are now opted ${
              isOptIn ? 'in :white_check_mark:' : 'out :x:'
            }.`,
          );
          await userResponse?.delete();
        } catch (err) {
          console.error(err);
          await userResponse?.delete();
        }
      }
    }
  },
};

export = memberAvailableEvent;
