import {
  optInCommands,
  singleInstanceCommandsEnum,
} from './shared/discord-js-types';

export enum imageModelEnums {
  DALLE2 = 'dall-e-2',
  DALLE3 = 'dall-e-3',
}

export enum textBasedModelEnums {
  GPT4O = 'gpt-4o',
  GPT40_MINI = 'gpt-4o-mini',
}

export enum chatToolsEnum {
  CREATE_IMAGE = 'create_image',
}

export const IMAGE_PROCESSING_MODELS = [
  textBasedModelEnums.GPT40_MINI,
  textBasedModelEnums.GPT4O,
];

export const config = {
  botId: '',
  openAi: {
    defaultChatCompletionModel: textBasedModelEnums.GPT40_MINI,
    defaultImageModel: imageModelEnums.DALLE2,
  },
  commands: {
    singleInstanceCommands: [
      singleInstanceCommandsEnum.LETS_CHAT,
      singleInstanceCommandsEnum.ASSISTANT,
    ],
    optInCommands: [
      optInCommands.CREATE_PROFILE,
      optInCommands.SELECT_PROFILE_SETTINGS,
    ],
  },
  functionTools: [
    {
      type: 'function',
      function: {
        name: chatToolsEnum.CREATE_IMAGE,
        strict: true,
        description:
          'Creates an image for the user. Call this whenever the user asks to create an image',
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
  ],
};
