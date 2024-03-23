import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CollectedInteraction, Events, Presence } from "discord.js";
import { Command } from "../shared/discord-js-types";
import { generateOptInCopy } from "../shared/constants";
import usersDao from "../database/users/usersDao";

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
            let userRecord = await usersDao.getUsers(userId);

            // If no user record exists for the available user, we will insert them into the database here
            if (userRecord.length === 0 && user) {
                const { id: discordId, username } = user;
                await usersDao.addUser({ discordId, username });
                userRecord = await usersDao.getUsers(user.id);
            }

            const userOptInData = await usersDao.getUserOptIn(userId);

            // If a user record exists and they have NOT responded to the opt-in question,
            // we will ask the user if they want to opt into data tracking.
            if (!userOptInData) {
                const confirm = new ButtonBuilder()
                    .setCustomId(CONFIRM_ID)
                    .setLabel('confirm')
                    .setStyle(ButtonStyle.Success);

                const cancel = new ButtonBuilder()
                    .setCustomId(CANCEL_ID)
                    .setLabel('opt out')
                    .setStyle(ButtonStyle.Secondary);

                const row = new ActionRowBuilder()
                    .addComponents(confirm, cancel);
                
                const userResponse = await user?.send({
                    content: generateOptInCopy(user.username),
                    components: [row as any],
                });

                const collectorFilter = (message: CollectedInteraction) => { return message?.user?.id === userId;};
                try {
                    // If the user does not respond in 2 minutes (120000) the optIn Message is deleted, and we will
                    // ask again later.
                    const optInResponse = await userResponse?.awaitMessageComponent({
                        filter: collectorFilter,
                        time: 120000,
                    }) as ButtonInteraction;
                    const isOptIn = optInResponse.customId === CONFIRM_ID;
                    await usersDao.insertUserOptIn(userId, isOptIn);
                    await user?.send(`Thank you for responding to the user data tracking questionnaire :slight_smile:.`);
                    await user?.send(`You are now opted ${isOptIn ? 
                        'in :white_check_mark:' : 'out :x:'}.`);
                    await userResponse?.delete();
                } catch (err) {
                    console.error(err);
                    await userResponse?.delete();
                }
            }
        }
    }
};

export = memberAvailableEvent;
