import { Events, GuildMember } from "discord.js";
import { Command } from "../shared/discord-js-types";
import usersDao from "../database/users/usersDao";


const newMemberEvent: Command = {
    name: Events.GuildMemberRemove,
    async execute(member: GuildMember) {
        const { id: discordId } = member.user; 
        await usersDao.deleteUser(discordId);

    }
}

export = newMemberEvent;