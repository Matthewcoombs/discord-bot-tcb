import { sql } from "../..";


export interface Channels {
    name: string;
    channelId: string;
}

export default {
    async getChannels(channelId: string) {
        const channels = await sql<Channels[]>`
            SELECT
                name,
                channel_id AS "channel_id"
            FROM
                discord_channels
            ${
                channelId ? sql`WHERE channel_id = ${channelId}` : sql``
            }
        `
    
            return channels;
    },
    
    async getChannelByName(channelName: string) {
        const channels = await sql<Channels[]>`
            SELECT
                name,
                channel_id AS "channelId"
            FROM 
                discord_channels
            WHERE
                name ILIKE ${channelName}
        `
    
        return channels[0];
    }
}
