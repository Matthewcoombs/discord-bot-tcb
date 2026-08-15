import {
  CLEAR_RETENTION_DATA,
  SELECT_CHAT_TIMEOUT_ID,
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
  GPT_IMAGE_2 = 'gpt-image-2-2026-04-21',
}

export enum textBasedModelEnums {
  GPT54_MINI = 'gpt-5.4-mini',
  GPT54 = 'gpt-5.4',
  CLAUDE_SONNET_4_6 = 'claude-sonnet-4-6',
  CLAUDE_HAIKU_4_5 = 'claude-haiku-4-5',
}

export enum openaiToolsEnum {
  GENERATE_IMAGE = 'generate_image',
  IMAGE_EDIT = 'image_edit',
  END_CHAT = 'end_chat',
  PROFILE_SETTINGS = 'profile_settings',
  VIEW_PROFILE_SETTINGS = 'view_profile_settings',
}

export enum anthropicToolsEnum {
  GENERATE_IMAGE = 'generate_image',
  IMAGE_EDIT = 'image_edit',
  END_CHAT = 'end_chat',
  PROFILE_SETTINGS = 'profile_settings',
  VIEW_PROFILE_SETTINGS = 'view_profile_settings',
}

export const IMAGE_PROCESSING_MODELS = [textBasedModelEnums.GPT54_MINI, textBasedModelEnums.GPT54];

export const OPEN_AI_TEXT_MODELS = [textBasedModelEnums.GPT54_MINI, textBasedModelEnums.GPT54];

export const CLAUDE_TEXT_MODELS = [
  textBasedModelEnums.CLAUDE_HAIKU_4_5,
  textBasedModelEnums.CLAUDE_SONNET_4_6,
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
}

// Base configuration that applies to all GPT image models
const baseImageConfig = {
  imageGeneration: {
    size: ['1024x1024', '1536x1024', '1024x1536'],
    quality: ['high', 'medium', 'low'],
  },
  imageEdit: {
    size: ['1024x1024', '1536x1024', '1024x1536'],
    quality: ['high', 'medium', 'low'],
    background: ['transparent', 'opaque', 'auto'],
  },
};

export const imageModelConfigOptions = {
  [imageModelEnums.GPT_IMAGE_2]: baseImageConfig,
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
      description: 'Creates an image. Call when the user asks to create an image.',
      parameters: {
        type: 'object',
        properties: {
          model: {
            type: 'string',
            description: 'image model',
            enum: [imageModelEnums.GPT_IMAGE_2],
          },
          prompt: {
            type: 'string',
            description: 'description of the image to create',
          },
          gptImageQuality: {
            type: 'string',
            description: 'image quality',
            enum: ['high', 'medium', 'low'],
          },
          n: {
            type: 'string',
            description: 'number of images',
            enum: ['1', '2', '3', '4'],
          },
          gptImageSize: {
            type: 'string',
            description:
              'image size as WIDTHxHEIGHT in pixels. Both edges must be multiples of 16, longest edge under 3840, long:short ratio at most 3:1, total pixels between 655360 and 8294400. Examples: 1024x1024, 1536x1024, 1024x1536, 1920x1088.',
          },
        },
        required: ['model', 'gptImageQuality', 'prompt', 'n', 'gptImageSize'],
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
        'Edits an uploaded image. Call when the user uploads an image and asks to edit it.',
      parameters: {
        type: 'object',
        properties: {
          model: {
            type: 'string',
            description: 'image model',
            enum: [imageModelEnums.GPT_IMAGE_2],
          },
          prompt: {
            type: 'string',
            description: 'description of the edits to make',
          },
          n: {
            type: 'string',
            description: 'number of images',
            enum: ['1', '2', '3', '4'],
          },
          gptImageSize: {
            type: 'string',
            description:
              'image size as WIDTHxHEIGHT in pixels. Both edges must be multiples of 16, longest edge under 3840, long:short ratio at most 3:1, total pixels between 655360 and 8294400. Examples: 1024x1024, 1536x1024, 1024x1536, 1920x1088.',
          },
          gptImageQuality: {
            type: 'string',
            description: 'image quality',
            enum: ['high', 'medium', 'low'],
          },
          gptImageBackground: {
            type: 'string',
            description: 'image background',
            enum: ['transparent', 'opaque', 'auto'],
          },
        },
        required: ['model', 'prompt', 'n', 'gptImageSize', 'gptImageQuality', 'gptImageBackground'],
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
        'Call when the user ends the chat (e.g. "I am done", "end the chat") or context indicates the session is over.',
      parameters: {
        type: 'object',
        properties: {
          finalResponse: {
            type: 'string',
            description: 'the final message sent to the user',
          },
        },
        required: ['finalResponse'],
        additionalProperties: false,
      },
    },
  },
];

const TIMEOUT_OPTIONS = [180000, 300000, 480000, 600000];
const RETENTION_SIZE_OPTIONS = [20, 15, 10, 5, 0];

export const config = {
  botId: '',
  openAi: {
    defaultChatCompletionModel: textBasedModelEnums.GPT54_MINI,
    defaultImageModel: imageModelEnums.GPT_IMAGE_2,
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
            },
            required: [
              'selectedSettings',
              'textModel',
              'timeout',
              'retention',
              'retentionSize',
              'clearRetentionData',
            ],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: openaiToolsEnum.VIEW_PROFILE_SETTINGS,
          strict: true,
          description:
            "Shows all current settings for the user's selected profile. Call this when the user asks to view, see, or check their profile settings",
          parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        },
      },
    ],
  },
  anthropic: {
    defaultMessageModel: textBasedModelEnums.CLAUDE_HAIKU_4_5,
    tools: [
      {
        name: anthropicToolsEnum.GENERATE_IMAGE,
        description: 'Creates an image. Call when the user explicitly asks to create an image.',
        input_schema: {
          type: 'object',
          properties: {
            model: {
              type: 'string',
              description: 'image model',
              enum: [imageModelEnums.GPT_IMAGE_2],
            },
            prompt: {
              type: 'string',
              description: 'description of the image to create',
            },
            gptImageQuality: {
              type: 'string',
              description: 'image quality',
              enum: ['high', 'medium', 'low'],
            },
            n: {
              type: 'string',
              description: 'number of images',
              enum: ['1', '2', '3', '4'],
            },
            gptImageSize: {
              type: 'string',
              description:
                'image size as WIDTHxHEIGHT in pixels. Both edges must be multiples of 16, longest edge under 3840, long:short ratio at most 3:1, total pixels between 655360 and 8294400. Examples: 1024x1024, 1536x1024, 1024x1536, 1920x1088.',
            },
          },
          required: ['model', 'prompt', 'gptImageQuality', 'n', 'gptImageSize'],
        },
      },
      {
        name: anthropicToolsEnum.IMAGE_EDIT,
        description:
          'Edits an uploaded image. Call when an image is present in the conversation and the user wants to modify, change, or alter it.',
        input_schema: {
          type: 'object',
          properties: {
            model: {
              type: 'string',
              description: 'image model',
              enum: [imageModelEnums.GPT_IMAGE_2],
            },
            prompt: {
              type: 'string',
              description: 'description of the edits to make',
            },
            n: {
              type: 'string',
              description: 'number of images',
              enum: ['1', '2', '3', '4'],
            },
            gptImageSize: {
              type: 'string',
              description:
                'image size as WIDTHxHEIGHT in pixels. Both edges must be multiples of 16, longest edge under 3840, long:short ratio at most 3:1, total pixels between 655360 and 8294400. Examples: 1024x1024, 1536x1024, 1024x1536, 1920x1088.',
            },
            gptImageQuality: {
              type: 'string',
              description: 'image quality',
              enum: ['high', 'medium', 'low'],
            },
            gptImageBackground: {
              type: 'string',
              description: 'image background',
              enum: ['transparent', 'opaque', 'auto'],
            },
          },
          required: [
            'model',
            'prompt',
            'n',
            'gptImageSize',
            'gptImageQuality',
            'gptImageBackground',
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
          },
          required: [
            'selectedSettings',
            'textModel',
            'timeout',
            'retention',
            'retentionSize',
            'clearRetentionData',
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
      {
        name: anthropicToolsEnum.VIEW_PROFILE_SETTINGS,
        description:
          "Shows all current settings for the user's selected profile. Call this when the user asks to view, see, or check their profile settings",
        input_schema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  },
  commands: {
    singleInstanceCommands: [singleInstanceCommandsEnum.ASSISTANT],
    optInCommands: [
      optInCommands.CREATE_PROFILE,
      optInCommands.SELECT_PROFILE_SETTINGS,
      optInCommands.VIEW_PROFILE_SETTINGS,
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
  // Maximum number of recent transcript messages sent to the model per turn.
  // Caps within-session prompt growth; cross-session memory is handled
  // separately by retention data (which has its own size cap).
  messageContextWindowSize: 20,
  generativeConstraints: `\nNOTE keep your responses as short, clear, and concise as possible. Your messages should not exceed 2000 characters unless absolutely necessary.`,
};
