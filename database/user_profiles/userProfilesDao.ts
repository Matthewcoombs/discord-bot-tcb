import { MessageParam } from '@anthropic-ai/sdk/resources';
import { pg } from '../..';
import { aiServiceEnums, config, textBasedModelEnums } from '../../config';
import { ChatCompletionMessage } from '../../openAIClient/chatCompletion/chatCompletion.service';
import { cleanPGText } from '../../shared/utils';

export interface UserProfile {
  id: string | number;
  discordId: string;
  name: string;
  profile: string;
  service: aiServiceEnums;
  createdAt: string;
  updatedAt: string;
  selected?: boolean;
  textModel: textBasedModelEnums;
  timeout: string | number;
  retention: boolean;
  openAiRetentionData: ChatCompletionMessage[];
  anthropicRetentionData: Array<MessageParam>;
  optimizedOpenAiRetentionData: string;
  optimizedAnthropicRetentionData: string;
  retentionSize: string | number;
  temperature: number;
}

export interface CreateProfile {
  name: string;
  profile: string;
  discordId: string;
  selected?: boolean;
  textModel: string;
  service: aiServiceEnums;
}

export function validateUserProfileCount(userProfiles: UserProfile[]): boolean {
  // If the amount of profiles the user has is less than the PROFILES_LIMIT, the
  // profile count is valid. Otherwise it is invalid and the user cannot create
  // more profiles at this time.
  return userProfiles.length < config.profilesLimit;
}
const PROFILES_BASE_SELECTORS = `
  id,
  discord_id AS "discordId",
  name,
  profile,
  service,
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  text_model AS "textModel",
  timeout,
  selected,
  retention,
  openai_retention_data AS "openAiRetentionData",
  anthropic_retention_data AS "anthropicRetentionData",
  optimized_openai_retention_data AS "optimizedOpenAiRetentionData",
  optimized_anthropic_retention_data AS "optimizedAnthropicRetentionData",
  retention_size AS "retentionSize",
  temperature
`;
const PROFILES_BASE_QUERY = `
  SELECT
    ${PROFILES_BASE_SELECTORS}
  FROM
    user_profiles
  `;

export default {
  async getUserProfiles(discordId: string) {
    const userProfiles = await pg.query<UserProfile>(
      `${PROFILES_BASE_QUERY} 
      WHERE 
        discord_id = '${discordId}'`,
    );
    return userProfiles.rows;
  },

  async getUserProfileById(profileId: string) {
    const userProfiles = await pg.query<UserProfile>(
      `${PROFILES_BASE_QUERY}
        WHERE
          id = ${profileId}`,
    );
    return userProfiles.rows[0];
  },

  async getSelectedProfile(userId: string) {
    const userProfiles = await pg.query<UserProfile>(`
            ${PROFILES_BASE_QUERY}
            WHERE
                selected = 'true'
            AND
                discord_id = '${userId}'
        `);
    return userProfiles.rows[0];
  },

  async insertUserProfile(newProfile: CreateProfile) {
    const { name, profile, service, discordId, textModel } = newProfile;
    const userProfiles = await pg.query<UserProfile>(`
            INSERT INTO
                user_profiles
                (discord_id, name, profile, service, retention, retention_size, text_model)
            VALUES
                ('${discordId}', '${cleanPGText(name)}', '${cleanPGText(profile)}', '${service}', true, ${config.defaults.retentionSize}, '${textModel}')
            RETURNING
            ${PROFILES_BASE_SELECTORS}

        `);
    return userProfiles.rows[0];
  },

  async deleteUserProfile(profileId: string) {
    await pg.query(`
            DELETE FROM
                user_profiles
            WHERE
                id = ${profileId}
        `);
  },

  async updateUserProfile(selectedProfile: UserProfile) {
    const {
      name,
      profile,
      service,
      selected,
      textModel,
      timeout,
      retention,
      openAiRetentionData,
      anthropicRetentionData,
      retentionSize,
      optimizedOpenAiRetentionData,
      optimizedAnthropicRetentionData,
      temperature,
    } = selectedProfile;

    let retentionUpdateColumn: string = '';
    let retentionDataToReduce: ChatCompletionMessage[] | Array<MessageParam> = [];
    if (service === aiServiceEnums.OPENAI) {
      retentionUpdateColumn = `openai_retention_data`;
      retentionDataToReduce = openAiRetentionData;
    }

    if (service === aiServiceEnums.ANTHROPIC) {
      retentionUpdateColumn = `anthropic_retention_data`;
      retentionDataToReduce = anthropicRetentionData;
    }

    if (retentionDataToReduce && retentionDataToReduce.length > Number(retentionSize)) {
      retentionDataToReduce.splice(0, retentionDataToReduce.length - Number(retentionSize));
    }

    await pg.query(
      `
            UPDATE
                user_profiles
            SET
                name = '${cleanPGText(name)}',
                profile = '${cleanPGText(profile)}',
                service = '${service}',
                selected = ${selected},
                text_model = '${textModel}',
                timeout = ${timeout},
                retention = ${retention},
                temperature = ${temperature},
                ${retentionUpdateColumn} = $1,
                retention_size = ${retentionSize},
                optimized_openai_retention_data = '${cleanPGText(optimizedOpenAiRetentionData || '')}',
                optimized_anthropic_retention_data = '${cleanPGText(optimizedAnthropicRetentionData || '')}',
                updated_at = NOW()
            WHERE
                id = ${selectedProfile.id}
        `,
      [retentionDataToReduce],
    );
  },

  async updateProfileSelection(selectedProfile: UserProfile) {
    const { id, discordId } = selectedProfile;
    await pg.query(`
            UPDATE
                user_profiles
            SET
                selected = 'true',
                updated_at = NOW()
            WHERE
                id = ${id}
        `);

    await pg.query(`
            UPDATE
                user_profiles
            SET
                selected = 'false'
            WHERE
                id != ${id}
            AND
                discord_id = '${discordId}'
        `);
  },
};
