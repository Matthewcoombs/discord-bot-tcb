import { sql } from "../..";
import { PROFILES_LIMIT } from "../../shared/constants";

export interface UserProfile {
    id: string | number;
    discordId: string;
    name: string;
    profile: string;
    createdAt: string;
    updatedAt: string;
    assistantId: string;
    selected?: boolean;
    textModel: string;
    threadId: string;
}

export interface CreateProfile {
    name: string;
    profile: string;
    discordId: string;
    assistantId: string;
    selected?: boolean;
    threadId: string;
}

export function validateUserProfileCount(userProfiles: UserProfile[]): boolean {
    // If the amount of profiles the user has is less than the PROFILES_LIMIT, the
    // profile count is valid. Otherwise it is invalid and the user cannot create
    // more profiles at this time.
    return userProfiles.length < PROFILES_LIMIT;
}

const getUserProfilesBaseQuery = sql`
    SELECT
        id,
        discord_id AS "discordId",
        name,
        profile,
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        assistant_id AS "assistantId",
        text_model AS "textModel",
        thread_id AS "threadId",
        selected
    FROM
        user_profiles
`;

export default {
    async getUserProfiles(discordId: string) {
        const userProfiles = await sql<UserProfile[]>`
            ${getUserProfilesBaseQuery}
            WHERE
                discord_id = ${discordId}
        `;

        return userProfiles;
    },

    async getUserProfileById(profileId: string) {
        const userProfiles = await sql<UserProfile[]>`
            ${getUserProfilesBaseQuery}
            WHERE
                id = ${profileId}
        `;
        return userProfiles[0];
    },

    async getSelectedProfile(userId: string) {
        const userProfiles = await sql<UserProfile[]>`
            ${getUserProfilesBaseQuery}
            WHERE
                selected = 'true'
            AND
                discord_id = ${userId}
        `;
        return userProfiles[0];
    },

    async insertUserProfile(newProfile: CreateProfile) {
        const { name, profile, discordId, assistantId, threadId} = newProfile;
        await sql`
            INSERT INTO
                user_profiles
                (discord_id, name, profile, assistant_id, thread_id)
            VALUES
                (${discordId}, ${name}, ${profile}, ${assistantId}, ${threadId})
        `;
    },

    async deleteUserProfile(profileId: string) {
        await sql`
            DELETE FROM
                user_profiles
            WHERE
                id = ${profileId}
        `;
    },

    async updateUserProfile(selectedProfile: UserProfile) {
        const { name, profile, selected, textModel} = selectedProfile;
        await sql`
            UPDATE
                user_profiles
            SET
                name = ${name},
                profile = ${profile},
                selected = ${selected as boolean},
                text_model = ${textModel}
            WHERE
                id = ${selectedProfile.id}
        `;
    },

    async updateProfileSelection(selectedProfile: UserProfile) {
        const {id, discordId } = selectedProfile;
        await sql`
            UPDATE
                user_profiles
            SET
                selected = 'true'
            WHERE
                id = ${id}
        `;

        await sql`
            UPDATE
                user_profiles
            SET
                selected = 'false'
            WHERE
                id != ${id}
            AND
                discord_id = ${discordId}
        `;
    }
};