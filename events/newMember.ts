import { ChannelType, Events, GuildMember } from "discord.js";
import { Command } from "../shared/discord-js-types";
import usersDao from "../database/users/usersDao";
import channelsDao from "../database/channels/channelsDao";
import { GENERAL_CHANNEL, generateWelcomeCopy } from "../shared/constants";


const newMemberEvent: Command = {
    name: Events.GuildMemberAdd,
    async execute(member: GuildMember) {
        const { channelId } = await channelsDao.getChannelByName(GENERAL_CHANNEL);
        const generalChannel =  await member.client.channels.fetch(channelId);
        const { username, id: discordId } = member.user; 
        const newUser = { username, discordId };

        await usersDao.addUser(newUser);

        if (generalChannel && generalChannel.type === ChannelType.GuildText)  {
            await generalChannel.send(`Hey Everyone! Lets welcome ${username} to the server :tada:!`);
            await member.user.send({
                content: generateWelcomeCopy(username),
            })

        }


    }
}

export = newMemberEvent;