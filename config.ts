import {
  CLEAR_RETENTION_DATA,
  SELECT_CHAT_TIMEOUT_ID,
  SELECT_PROFILE_TEMPERATURE,
  SELECT_RETENTION_ID,
  SELECT_RETENTION_SIZE_ID,
  SELECT_TEXT_MODEL_ID,
} from './profiles/profiles.service';
import {
  optInCommands,
  singleInstanceCommandsEnum,
} from './shared/discord-js-types';

export enum aiServiceEnums {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
}

export enum imageModelEnums {
  DALLE2 = 'dall-e-2',
  DALLE3 = 'dall-e-3',
}

export enum textBasedModelEnums {
  GPT4O = 'gpt-4o',
  GPT40_MINI = 'gpt-4o-mini',
  CLAUDE_3_5_SONNET = 'claude-3-5-sonnet-20241022',
  CLAUDE_3_5_HAIKU = 'claude-3-5-haiku-20241022',
}

export enum openaiToolsEnum {
  GENERATE_IMAGE = 'generate_image',
  END_CHAT = 'end_chat',
  PROFILE_SETTINGS = 'profile_settings',
}

export enum anthropicToolsEnum {
  GENERATE_IMAGE = 'generate_image',
  END_CHAT = 'end_chat',
  PROFILE_SETTINGS = 'profile_settings',
}

export const IMAGE_PROCESSING_MODELS = [
  textBasedModelEnums.GPT40_MINI,
  textBasedModelEnums.GPT4O,
];

export const OPEN_AI_TEXT_MODELS = [
  textBasedModelEnums.GPT40_MINI,
  textBasedModelEnums.GPT4O,
];

export const CLAUDE_TEXT_MODELS = [
  textBasedModelEnums.CLAUDE_3_5_HAIKU,
  textBasedModelEnums.CLAUDE_3_5_SONNET,
];

export interface FinalResponse {
  finalResponse: string;
}

export interface ProfileSettingsArgs {
  selectedSettings: string[];
  textModel: string;
  timeout: string;
  retention: string;
  retentionSize: string;
  clearRetentionData: string;
  temperature: string;
}

function generateTemperatureOptions(tempRange: number[]): number[] {
  const tempOptions: number[] = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const interpolatedValue = tempRange[0] + t * (tempRange[1] - tempRange[0]);
    tempOptions.push(Number(interpolatedValue.toFixed(2)));
  }
  return tempOptions;
}

const TIMEOUT_OPTIONS = [180000, 300000, 480000, 600000];
const RETENTION_SIZE_OPTIONS = [100, 75, 50, 25, 0];
const OPEN_AI_TEMP_RANGE = [0, 2];
const OPEN_AI_TEMP_OPTIONS = generateTemperatureOptions(OPEN_AI_TEMP_RANGE);
const ANTHROPIC_TEMP_RANGE = [0, 1];
const ANTHROPIC_TEMP_OPTIONS = generateTemperatureOptions(ANTHROPIC_TEMP_RANGE);

export const config = {
  botId: '',
  openAi: {
    defaultChatCompletionModel: textBasedModelEnums.GPT40_MINI,
    defaultImageModel: imageModelEnums.DALLE2,
    // temperature ranges - [min, max]
    temperatureRange: OPEN_AI_TEMP_RANGE,
    temperatureOptions: OPEN_AI_TEMP_OPTIONS,
    tools: [
      {
        type: 'function',
        function: {
          name: openaiToolsEnum.GENERATE_IMAGE,
          strict: true,
          description:
            'Creates an image for the user. Call this when the user explicitly asks to create an image',
          parameters: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'the description of the image to create',
              },
              quality: {
                type: 'string',
                description: 'the quality of the image to create',
                enum: ['standard', 'hd'],
              },
              style: {
                type: 'string',
                description: 'the style of the image to create',
                enum: ['vivid', 'natural'],
              },
              count: {
                type: 'string',
                description: 'the number of images to create',
                enum: ['1', '2', '3', '4'],
              },
              size: {
                type: 'string',
                description: 'the size of image to create',
                enum: ['1024x1024', '1792x1024', '1024x1792'],
              },
            },
            required: ['description', 'quality', 'style', 'count', 'size'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: openaiToolsEnum.PROFILE_SETTINGS,
          strict: true,
          description: `This function should be called whenever the user asks to update the settings for their current profile`,
          parameters: {
            type: 'object',
            properties: {
              selectedSettings: {
                description:
                  'the settings chosen to update. This will be used to determine which setting to update',
                type: 'array',
                items: {
                  type: 'string',
                  enum: [
                    SELECT_TEXT_MODEL_ID,
                    SELECT_CHAT_TIMEOUT_ID,
                    SELECT_RETENTION_ID,
                    SELECT_RETENTION_SIZE_ID,
                    CLEAR_RETENTION_DATA,
                    SELECT_PROFILE_TEMPERATURE,
                  ],
                },
              },
              textModel: {
                type: 'string',
                description: 'the text based model the profile will use',
                enum: OPEN_AI_TEXT_MODELS,
              },
              timeout: {
                type: 'string',
                description: 'the timeout the profile will use',
                enum: Array.from(TIMEOUT_OPTIONS, (num) => num.toString()),
              },
              retention: {
                type: 'string',
                description:
                  'determines wether or not the profile will use retention data',
                enum: ['true', 'false'],
              },
              retentionSize: {
                type: 'string',
                description: 'the retention size the profile will use',
                enum: Array.from(RETENTION_SIZE_OPTIONS, (num) =>
                  num.toString(),
                ),
              },
              clearRetentionData: {
                type: 'string',
                description:
                  'determines if the user wants to clear the current profile retention data or not',
                enum: ['true', 'false'],
              },
              temperature: {
                type: 'string',
                description:
                  'the temperature the profile will use in its responses',
                enum: Array.from(OPEN_AI_TEMP_OPTIONS, (num) => num.toString()),
              },
            },
            required: [
              'selectedSettings',
              'textModel',
              'timeout',
              'retention',
              'retentionSize',
              'clearRetentionData',
              'temperature',
            ],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: openaiToolsEnum.END_CHAT,
          strict: true,
          description:
            'This function should be called whenever the user decides the current chat session is over. The user might say something like "I am done" or "I want to end the chat" or just based on the context of the conversation the assistant can decide to end the chat',
          parameters: {
            type: 'object',
            properties: {
              finalResponse: {
                type: 'string',
                description:
                  'the final response to the user. This will be sent to the user',
              },
            },
            required: ['finalResponse'],
            additionalProperties: false,
          },
        },
      },
    ],
  },
  anthropic: {
    defaultMessageModel: textBasedModelEnums.CLAUDE_3_5_HAIKU,
    //temperature ranges - [min, max]
    temperatureRange: [0, 1],
    temperatureOptions: ANTHROPIC_TEMP_OPTIONS,
    tools: [
      {
        name: anthropicToolsEnum.GENERATE_IMAGE,
        description:
          'Creates an image for the user. Call this when the user explicitly asks to create an image',
        input_schema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'the description of the image to create',
            },
            quality: {
              type: 'string',
              description: 'the quality of the image to create',
              enum: ['standard', 'hd'],
            },
            style: {
              type: 'string',
              description: 'the style of the image to create',
              enum: ['vivid', 'natural'],
            },
            count: {
              type: 'string',
              description: 'the number of images to create',
              enum: ['1', '2', '3', '4'],
            },
            size: {
              type: 'string',
              description: 'the size of image to create',
              enum: ['1024x1024', '1792x1024', '1024x1792'],
            },
          },
          required: ['description', 'quality', 'style', 'count', 'size'],
        },
      },
      {
        name: anthropicToolsEnum.PROFILE_SETTINGS,
        description: `This function should be called whenever the user asks to update the settings for their current profile`,
        input_schema: {
          type: 'object',
          properties: {
            selectedSettings: {
              description:
                'the settings chosen to update. This will be used to determine which setting to update',
              type: 'array',
              items: {
                type: 'string',
                enum: [
                  SELECT_TEXT_MODEL_ID,
                  SELECT_CHAT_TIMEOUT_ID,
                  SELECT_RETENTION_ID,
                  SELECT_RETENTION_SIZE_ID,
                  CLEAR_RETENTION_DATA,
                  SELECT_PROFILE_TEMPERATURE,
                ],
              },
            },
            textModel: {
              type: 'string',
              description: 'the text based model the profile will use',
              enum: CLAUDE_TEXT_MODELS,
            },
            timeout: {
              type: 'string',
              description: 'the timeout the profile will use',
              enum: Array.from(TIMEOUT_OPTIONS, (num) => num.toString()),
            },
            retention: {
              type: 'string',
              description:
                'determines wether or not the profile will use retention data',
              enum: ['true', 'false'],
            },
            retentionSize: {
              type: 'string',
              description: 'the retention size the profile will use',
              enum: Array.from(RETENTION_SIZE_OPTIONS, (num) => num.toString()),
            },
            clearRetentionData: {
              type: 'string',
              description:
                'determines if the user wants to clear the current profile retention data or not',
              enum: ['true', 'false'],
            },
            temperature: {
              type: 'string',
              description:
                'the temperature the profile will use in its responses',
              enum: Array.from(ANTHROPIC_TEMP_OPTIONS, (num) => num.toString()),
            },
          },
          required: [
            'selectedSettings',
            'textModel',
            'timeout',
            'retention',
            'retentionSize',
            'clearRetentionData',
            'temperature',
          ],
        },
      },
      {
        name: anthropicToolsEnum.END_CHAT,
        description:
          'This function should be called whenever the user decides the current chat session is over. The user might say something like "I am done" or "I want to end the chat" or just based on the context of the conversation the assistant can decide to end the chat',
        input_schema: {
          type: 'object',
          properties: {
            finalResponse: {
              type: 'string',
              description:
                'the final response to the user. This will be sent to the user',
            },
          },
          required: ['finalResponse'],
        },
      },
    ],
  },
  commands: {
    singleInstanceCommands: [singleInstanceCommandsEnum.ASSISTANT],
    optInCommands: [
      optInCommands.CREATE_PROFILE,
      optInCommands.SELECT_PROFILE_SETTINGS,
    ],
  },
  chatTimeoutOptions: TIMEOUT_OPTIONS,
  retentionSizeOptions: RETENTION_SIZE_OPTIONS,
  defaults: {
    service: aiServiceEnums.OPENAI,
    chatTimeout: 300000,
    retentionSize: 0,
  },
  profilesLimit: 4,
  attachmentsLimit: 4,
  singleInstanceCommandsLimit: 4,
  messageCollectorsLimit: 100,
  discordReplyLengthLimit: 2000,
  // Setting 4mb image size limit
  imageTouchUpSizeLimit: 4000000,
  generativeConstraints: `\nNOTE keep your responses as short, clear, and concise as possible. Your messages should not exceed 2000 characters unless absolutely necessary.`,
};
