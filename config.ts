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

export enum chatToolsEnum {
  GENERATE_IMAGE = 'generate_image',
  END_CHAT = 'end_chat',
}

export const IMAGE_PROCESSING_MODELS = [
  textBasedModelEnums.GPT40_MINI,
  textBasedModelEnums.GPT4O,
];

export interface FinalResponse {
  finalResponse: string;
}

export const config = {
  botId: '',
  openAi: {
    defaultChatCompletionModel: textBasedModelEnums.GPT40_MINI,
    defaultImageModel: imageModelEnums.DALLE2,
  },
  claude: {
    defaultMessageModel: textBasedModelEnums.CLAUDE_3_5_HAIKU,
  },
  commands: {
    singleInstanceCommands: [singleInstanceCommandsEnum.ASSISTANT],
    optInCommands: [
      optInCommands.CREATE_PROFILE,
      optInCommands.SELECT_PROFILE_SETTINGS,
    ],
  },
  functionTools: [
    {
      type: 'function',
      function: {
        name: chatToolsEnum.GENERATE_IMAGE,
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
        name: chatToolsEnum.END_CHAT,
        strict: true,
        description: 'End the chat whenever the user ends or leaves the chat',
        parameters: {
          type: 'object',
          properties: {
            finalResponse: {
              type: 'string',
              description: 'the final response to the user',
            },
          },
          required: ['finalResponse'],
          additionalProperties: false,
        },
      },
    },
  ],
};
