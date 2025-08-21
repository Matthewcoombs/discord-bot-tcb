import {
  CLEAR_RETENTION_DATA,
  SELECT_CHAT_TIMEOUT_ID,
  SELECT_PROFILE_TEMPERATURE,
  SELECT_RETENTION_ID,
  SELECT_RETENTION_SIZE_ID,
  SELECT_TEXT_MODEL_ID,
} from './profiles/profiles.service';
import { optInCommands, singleInstanceCommandsEnum } from './shared/discord-js-types';

export enum aiServiceEnums {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
}

export enum imageModelEnums {
  DALLE2 = 'dall-e-2',
  DALLE3 = 'dall-e-3',
  GPT_IMAGE_1 = 'gpt-image-1',
}

export enum textBasedModelEnums {
  GPT41 = 'gpt-4.1-2025-04-14',
  GPT41_MINI = 'gpt-4.1-mini-2025-04-14',
  GPT5 = 'gpt-5-2025-08-07',
  GPT5_NANO = 'gpt-5-nano-2025-08-07',
  GPT5_MINI = 'gpt-5-mini-2025-08-07',
  CLAUDE_3_5_SONNET = 'claude-3-5-sonnet-20241022',
  CLAUDE_3_5_HAIKU = 'claude-3-5-haiku-20241022',
}

export enum openaiToolsEnum {
  GENERATE_IMAGE = 'generate_image',
  IMAGE_EDIT = 'image_edit',
  END_CHAT = 'end_chat',
  PROFILE_SETTINGS = 'profile_settings',
}

export enum anthropicToolsEnum {
  GENERATE_IMAGE = 'generate_image',
  IMAGE_EDIT = 'image_edit',
  END_CHAT = 'end_chat',
  PROFILE_SETTINGS = 'profile_settings',
}

export const IMAGE_PROCESSING_MODELS = [
  textBasedModelEnums.GPT41_MINI,
  textBasedModelEnums.GPT41,
  textBasedModelEnums.GPT5,
  textBasedModelEnums.GPT5_NANO,
  textBasedModelEnums.GPT5_MINI,
];

export const OPEN_AI_TEXT_MODELS = [
  textBasedModelEnums.GPT41,
  textBasedModelEnums.GPT41_MINI,
  textBasedModelEnums.GPT5,
  textBasedModelEnums.GPT5_NANO,
  textBasedModelEnums.GPT5_MINI,
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

export const imageModelConfigOptions = {
  [imageModelEnums.DALLE2]: {
    imageGeneration: {
      size: ['256x256', '512x512', '1024x1024'],
    },
    imageEdit: {
      size: ['256x256', '512x512', '1024x1024'],
    },
  },
  [imageModelEnums.DALLE3]: {
    imageGeneration: {
      size: ['1024x1024', '1792x1024', '1024x1792'],
      quality: ['hd', 'standard', 'auto'],
      style: ['vivid', 'natural'],
    },
    imageEdit: {},
  },
  [imageModelEnums.GPT_IMAGE_1]: {
    imageGeneration: {
      size: ['1024x1024', '1536x1024', '1024x1536'],
      quality: ['high', 'medium', 'low'],
    },
    imageEdit: {
      size: ['1024x1024', '1536x1024', '1024x1536'],
      quality: ['high', 'medium', 'low'],
      background: ['transparent', 'opaque', 'auto'],
    },
  },
};

// These are the default tools available to users who have not set up their profile(s).
// By default users with no profile will have access to openai services, so the
// default tools are set to openai tools
export const DEFAULT_OPENAI_TOOLS = [
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
          model: {
            type: 'string',
            description: 'the model used to generate the image',
            enum: [imageModelEnums.DALLE3, imageModelEnums.GPT_IMAGE_1],
          },
          prompt: {
            type: 'string',
            description: 'the description of the image to create',
          },
          dalle3Quality: {
            type: 'string',
            description: 'the quality of the image to create. This is only used for dalle3',
            enum: ['standard', 'hd'],
          },
          gptImage1Quality: {
            type: 'string',
            description: 'the quality of the image to create. This is only used for gpt-image-1',
            enum: ['high', 'medium', 'low'],
          },
          style: {
            type: 'string',
            description: 'the style of the image to create. This is only used for dalle3',
            enum: ['vivid', 'natural'],
          },
          n: {
            type: 'string',
            description: 'the number of images to create',
            enum: ['1', '2', '3', '4'],
          },
          dalle3Size: {
            type: 'string',
            description: 'the size of image to create. This is only used for dalle3',
            enum: ['1024x1024', '1792x1024', '1024x1792'],
          },
          gptImage1Size: {
            type: 'string',
            description: 'the size of image to create. This is only used for gpt-image-1',
            enum: ['1024x1024', '1536x1024', '1024x1536'],
          },
        },
        required: [
          'model',
          'dalle3Quality',
          'gptImage1Quality',
          'prompt',
          'style',
          'n',
          'dalle3Size',
          'gptImage1Size',
        ],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: openaiToolsEnum.IMAGE_EDIT,
      strict: true,
      description:
        'Edits an uploaded image based on user instructions. Call this when the user uploads an image and asks to edit it',
      parameters: {
        type: 'object',
        properties: {
          model: {
            type: 'string',
            description: 'the model used to edit the image',
            enum: [imageModelEnums.DALLE2, imageModelEnums.GPT_IMAGE_1],
          },
          prompt: {
            type: 'string',
            description: 'the description of the edits to make to the image',
          },
          n: {
            type: 'string',
            description: 'the number of edited images to create',
            enum: ['1', '2', '3', '4'],
          },
          dalle2Size: {
            type: 'string',
            description: 'the size of image to create. This is only used for dalle2',
            enum: ['256x256', '512x512', '1024x1024'],
          },
          gptImage1Size: {
            type: 'string',
            description: 'the size of image to create. This is only used for gpt-image-1',
            enum: ['1024x1024', '1536x1024', '1024x1536'],
          },
          gptImage1Quality: {
            type: 'string',
            description: 'the quality of the image to create. This is only used for gpt-image-1',
            enum: ['high', 'medium', 'low'],
          },
          gptImage1Background: {
            type: 'string',
            description: 'the background setting for the image. This is only used for gpt-image-1',
            enum: ['transparent', 'opaque', 'auto'],
          },
        },
        required: [
          'model',
          'prompt',
          'n',
          'dalle2Size',
          'gptImage1Size',
          'gptImage1Quality',
          'gptImage1Background',
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
            description: 'the final response to the user. This will be sent to the user',
          },
        },
        required: ['finalResponse'],
        additionalProperties: false,
      },
    },
  },
];

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
    defaultChatCompletionModel: textBasedModelEnums.GPT41_MINI,
    defaultImageModel: imageModelEnums.DALLE2,
    // temperature ranges - [min, max]
    temperatureRange: OPEN_AI_TEMP_RANGE,
    temperatureOptions: OPEN_AI_TEMP_OPTIONS,
    tools: [
      ...DEFAULT_OPENAI_TOOLS,
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
                description:
                  'the timeout the profile will use warn the user this will not be applied to the current session',
                enum: Array.from(TIMEOUT_OPTIONS, num => num.toString()),
              },
              retention: {
                type: 'string',
                description: 'determines wether or not the profile will use retention data',
                enum: ['true', 'false'],
              },
              retentionSize: {
                type: 'string',
                description: 'the retention size the profile will use',
                enum: Array.from(RETENTION_SIZE_OPTIONS, num => num.toString()),
              },
              clearRetentionData: {
                type: 'string',
                description:
                  'determines if the user wants to clear the current profile retention data or not',
                enum: ['true', 'false'],
              },
              temperature: {
                type: 'string',
                description: 'the temperature the profile will use in its responses',
                enum: Array.from(OPEN_AI_TEMP_OPTIONS, num => num.toString()),
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
          'Creates an image for the user call this when the user explicitly asks to create an image',
        input_schema: {
          type: 'object',
          properties: {
            model: {
              type: 'string',
              description: 'the model used to generate the image',
              enum: [imageModelEnums.DALLE3, imageModelEnums.GPT_IMAGE_1],
            },
            prompt: {
              type: 'string',
              description: 'the description of the image to create',
            },
            dalle3Quality: {
              type: 'string',
              description: 'the quality of the image to create this is only used for dalle3',
              enum: ['standard', 'hd'],
            },
            gptImage1Quality: {
              type: 'string',
              description: 'the quality of the image to create this is only used for gpt-image-1',
              enum: ['high', 'medium', 'low'],
            },
            style: {
              type: 'string',
              description: 'the style of the image to create this is only used for dalle3',
              enum: ['vivid', 'natural'],
            },
            n: {
              type: 'string',
              description: 'the number of images to create',
              enum: ['1', '2', '3', '4'],
            },
            dalle3Size: {
              type: 'string',
              description: 'the size of image to create this is only used for dalle3',
              enum: ['1024x1024', '1792x1024', '1024x1792'],
            },
            gptImage1Size: {
              type: 'string',
              description: 'the size of image to create this is only used for gpt-image-1',
              enum: ['1024x1024', '1536x1024', '1024x1536'],
            },
          },
          required: [
            'model',
            'prompt',
            'dalle3Quality',
            'gptImage1Quality',
            'style',
            'n',
            'dalle3Size',
            'gptImage1Size',
          ],
        },
      },
      {
        name: anthropicToolsEnum.IMAGE_EDIT,
        description:
          'Edits an uploaded image based on user instructions. Call this when the user uploads an image and asks to edit it, modify it, change it, or make alterations to it. Always use this tool when you can see an image in the conversation and the user wants to modify that image.',
        input_schema: {
          type: 'object',
          properties: {
            model: {
              type: 'string',
              description: 'the model used to edit the image',
              enum: [imageModelEnums.DALLE2, imageModelEnums.GPT_IMAGE_1],
            },
            prompt: {
              type: 'string',
              description: 'the description of the edits to make to the image',
            },
            n: {
              type: 'string',
              description: 'the number of edited images to create',
              enum: ['1', '2', '3', '4'],
            },
            dalle2Size: {
              type: 'string',
              description: 'the size of image to create this is only used for dalle2',
              enum: ['256x256', '512x512', '1024x1024'],
            },
            gptImage1Size: {
              type: 'string',
              description: 'the size of image to create this is only used for gpt-image-1',
              enum: ['1024x1024', '1536x1024', '1024x1536'],
            },
            gptImage1Quality: {
              type: 'string',
              description: 'the quality of the image to create this is only used for gpt-image-1',
              enum: ['high', 'medium', 'low'],
            },
            gptImage1Background: {
              type: 'string',
              description: 'the background setting for the image this is only used for gpt-image-1',
              enum: ['transparent', 'opaque', 'auto'],
            },
          },
          required: [
            'model',
            'prompt',
            'n',
            'dalle2Size',
            'gptImage1Size',
            'gptImage1Quality',
            'gptImage1Background',
          ],
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
                'the settings chosen to update this will be used to determine which setting to update',
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
              description:
                'the timeout the profile will use warn the user this will not be applied to the current session',
              enum: Array.from(TIMEOUT_OPTIONS, num => num.toString()),
            },
            retention: {
              type: 'string',
              description: 'determines wether or not the profile will use retention data',
              enum: ['true', 'false'],
            },
            retentionSize: {
              type: 'string',
              description: 'the retention size the profile will use',
              enum: Array.from(RETENTION_SIZE_OPTIONS, num => num.toString()),
            },
            clearRetentionData: {
              type: 'string',
              description:
                'determines if the user wants to clear the current profile retention data or not',
              enum: ['true', 'false'],
            },
            temperature: {
              type: 'string',
              description: 'the temperature the profile will use in its responses',
              enum: Array.from(ANTHROPIC_TEMP_OPTIONS, num => num.toString()),
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
              description: 'the final response to the user this will be sent to the user',
            },
          },
          required: ['finalResponse'],
        },
      },
    ],
  },
  commands: {
    singleInstanceCommands: [singleInstanceCommandsEnum.ASSISTANT],
    optInCommands: [optInCommands.CREATE_PROFILE, optInCommands.SELECT_PROFILE_SETTINGS],
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
  generativeConstraints: `\nNOTE keep your responses as short, clear, and concise as possible. Your messages should not exceed 2000 characters unless absolutely necessary.`,
};
