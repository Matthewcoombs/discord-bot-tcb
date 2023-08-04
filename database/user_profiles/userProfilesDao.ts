import { sql } from "../..";
import { PROFILES_LIMIT } from "../../shared/constants";

export interface UserProfile {
    id: string;
    discordId: string;
    name: string;
    profile: string;
    createdAt: string;
    updatedAt: string;
}

export interface NewProfile {
    name: string;
    profile: string;
    discordId: string;
}

export function validateUserProfileCount(userProfiles: UserProfile[]): boolean {
    // If the amount of profiles the user has is less than the PROFILES_LIMIT, the
    // profile count is valid. Otherwise it is invalid and the user cannot create
    // more profiles at this time.
    return userProfiles.length < PROFILES_LIMIT ? true : false
}

export default {
    async getUserProfiles(discordId: string) {
        const userProfiles = await sql<UserProfile[]>`
            SELECT
                id,
                discord_id AS "discordId",
                name,
                profile,
                created_at AS "createdAt",
                updated_at AS "updatedAt"
            FROM
                user_profiles
            WHERE
                discord_id = ${discordId}
        `;

        return userProfiles;
    },

    async getUserProfileById(profileId: string) {
        const userProfiles = await sql<UserProfile[]>`
            SELECT
                id,
                discord_id AS "discordId",
                name,
                profile,
                created_at AS "createdAt",
                updated_at AS "updatedAt"
            FROM
                user_profiles
            WHERE
                id = ${profileId}
        `;
        return userProfiles[0];
    },

    async insertUserProfile(newProfile: NewProfile) {
        const { name, profile, discordId } = newProfile;
        await sql`
            INSERT INTO
                user_profiles
                (discord_id, name, profile)
            VALUES
                (${discordId}, ${name}, ${profile})
        `
    },

    async deleteUserProfile(profileId: string) {
        await sql`
            DELETE FROM
                user_profiles
            WHERE
                id = ${profileId}
        `
    }
}