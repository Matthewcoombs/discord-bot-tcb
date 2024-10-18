import { pg } from '../..';

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

const BASE_USER_QUERY = `
  SELECT
    id,
    discord_id AS "discordId",
    username,
    bot,
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM
    users
  `;

export default {
  async getUsers() {
    const users = await pg.query<DiscordUser>(BASE_USER_QUERY);
    return users.rows;
  },

  async getUserById(discordId: string) {
    const users = await pg.query<DiscordUser>(
      `${BASE_USER_QUERY}
      WHERE
        discord_id = '${discordId}'
      `,
    );
    return users.rows[0];
  },

  async addUser(newUser: NewUser) {
    const { discordId, username } = newUser;
    await pg.query(`
            INSERT INTO
                users
                (discord_id, username)
            VALUES
                ('${discordId}', '${username}')
        `);
  },

  async deleteUser(discordId: string) {
    await pg.query(`
            DELETE FROM
                users
            WHERE
                discord_id = '${discordId}'
        `);
  },

  async insertUserOptIn(discordId: string, optIn: boolean) {
    await pg.query(`
            INSERT INTO
                user_opt_in
                (discord_id, opt_in)
            VALUES
                ('${discordId}', ${optIn})
            ON CONFLICT 
                (discord_id) 
            DO NOTHING
        `);
  },

  async getUserOptIn(discordId: string) {
    const userOptInData = await pg.query<UserOptInData>(`
            SELECT
                id,
                discord_id AS "discordId",
                opt_in AS "optIn",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
            FROM
                user_opt_in
            WHERE
                discord_id = '${discordId}'
        `);

    return userOptInData.rows[0];
  },
};
