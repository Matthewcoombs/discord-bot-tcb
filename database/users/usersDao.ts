import { sql } from "../..";


export interface DiscordUser {
    id: string;
    discordId: string;
    username: string;
    bot: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface UserOptInData {
    id: string;
    discordId: string;
    optIn: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface NewUser {
    discordId: string;
    username: string;
}

export default {
    async getUsers(discordId: string) {
        const user = await sql<DiscordUser[]>`
            SELECT
                id,
                discord_id AS discordId,
                username,
                bot,
                created_at AS createdAt,
                updated_at AS updatedAt
            FROM 
                users
            ${discordId ? sql`WHERE discord_id = ${discordId}` : sql``}
            `;
        return user;
    },
    
    async addUser(newUser: NewUser) {
        const { discordId, username } = newUser;
        await sql`
            INSERT INTO
                users
                (discord_id, username)
            VALUES
                (${discordId}, ${username})
        `;
    },
    
    async deleteUser(discordId: string) {
        await sql`
            DELETE FROM
                users
            WHERE
                discord_id = ${discordId}
        `;
    },

    async insertUserOptIn(discordId: string, optIn: boolean) {
        await sql`
            INSERT INTO
                user_opt_in
                (discord_id, opt_in)
            VALUES
                (${discordId}, ${optIn})
            ON CONFLICT 
                (discord_id) 
            DO NOTHING
        `;
    },

    async getUserOptIn(discordId: string) {
        const userOptInData = await sql<UserOptInData[]>`
            SELECT
                id,
                discord_id AS "discordId",
                opt_in AS "optIn",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
            FROM
                user_opt_in
            WHERE
                discord_id = ${discordId}
        `;

        return userOptInData[0];
    }
};
