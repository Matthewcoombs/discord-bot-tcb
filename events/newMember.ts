import { ChannelType, Events, GuildMember } from "discord.js";
import { Command } from "../shared/discord-js-types";
import usersDao from "../database/users/usersDao";
import { generateWelcomeCopy } from "../shared/constants";


const newMemberEvent: Command = {
    name: Events.GuildMemberAdd,
    async execute(member: GuildMember) {
        const generalChannel = member.client.channels.cache.find(channel => channel.type === 0 && channel.name === 'general');
        const { username, id: discordId } = member.user; 
        const newUser = { username, discordId };

        await usersDao.addUser(newUser);

        if (generalChannel && generalChannel.type === ChannelType.GuildText)  {
            await generalChannel.send(`Hey Everyone! Lets welcome ${username} to the server :tada:!`);
            await member.user.send({
                content: generateWelcomeCopy(username),
            });

        }


    }
};

export = newMemberEvent;