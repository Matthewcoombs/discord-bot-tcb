import { sql } from "../..";
import { textBasedModelEnums } from "../../config";
import { ChatCompletionMessage } from "../../openAIClient/chatCompletion/chatCompletion.service";
import { DEFAULT_RETENTION_SIZE, PROFILES_LIMIT } from "../../shared/constants";

export interface UserProfile {
    id: string | number;
    discordId: string;
    name: string;
    profile: string;
    createdAt: string;
    updatedAt: string;
    assistantId: string;
    selected?: boolean;
    textModel: textBasedModelEnums;
    threadId: string;
    timeout: string | number;
    retention: boolean;
    retentionData: ChatCompletionMessage[];
    retentionSize: string | number;
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
        timeout,
        selected,
        retention,
        retention_data AS "retentionData",
        retention_size AS "retentionSize"
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
        const userProfile = userProfiles[0];
        return userProfile;
    },

    async insertUserProfile(newProfile: CreateProfile) {
        const { name, profile, discordId, assistantId, threadId} = newProfile;
        await sql`
            INSERT INTO
                user_profiles
                (discord_id, name, profile, assistant_id, thread_id, retention, retention_size)
            VALUES
                (${discordId}, ${name}, ${profile}, ${assistantId}, ${threadId}, true, ${DEFAULT_RETENTION_SIZE})
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
        const { 
            name, 
            profile, 
            selected, 
            textModel, 
            timeout, 
            retention,
            retentionData, 
            retentionSize
        } = selectedProfile;

        if (retentionData && retentionData.length > Number(retentionSize)) {
            retentionData.splice(0, retentionData.length - Number(retentionSize));
        }

        await sql`
            UPDATE
                user_profiles
            SET
                name = ${name},
                profile = ${profile},
                selected = ${selected as boolean},
                text_model = ${textModel},
                timeout = ${timeout},
                retention = ${retention},
                retention_data = ${retentionData as any},
                retention_size = ${retentionSize},
                updated_at = NOW()
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
                selected = 'true',
                updated_at = NOW()
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
    },

    async clearProfileRetentionData(selectedProfile: UserProfile) {
        const { id } = selectedProfile;
        await sql`
            UPDATE
                user_profiles
            SET
                retention_data = '{}',
                updated_at = NOW()
            WHERE
                id = ${id}
        `;
    }
};