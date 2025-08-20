import * as fs from 'fs';
import { TEMP_FOLDER_PATH } from './constants';
import {
  InteractionError,
  InvalidFileError,
  InvalidFileSizeError,
  InvalidFileTypeError,
} from './errors';
import axios from 'axios';
import { Attachment } from 'discord.js';
import { JsonContent } from '../openAIClient/chatCompletion/chatCompletion.service';
import { config, imageModelEnums } from '../config';

export function generateInteractionTag() {
  return Math.floor(10000 + Math.random() * 90000);
}

export function processBotResponseLength(response: string) {
  const responses: string[] = [];
  const { discordReplyLengthLimit } = config;
  for (let i = 0; i < response.length; i += discordReplyLengthLimit) {
    responses.push(response.slice(i, i + discordReplyLengthLimit));
  }
  return responses;
}

export async function getRemoteFileBufferData(fileUrl: string) {
  try {
    const { data } = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
    });
    return data;
  } catch (error) {
    throw new InteractionError({
      error: `There was an error retrieving the remote file data`,
      metaData: error,
    });
  }
}

export function createTempFile(bufferData: string, fileName: string) {
  const tempFilePath = `${TEMP_FOLDER_PATH}/${fileName}`;
  try {
    fs.writeFileSync(tempFilePath, bufferData);
  } catch (err) {
    throw new InvalidFileError({
      error: `There was an error creating a temp image file`,
      metaData: err,
    });
  }

  return tempFilePath;
}

export function deleteTempFilesByName(fileNames: string[]) {
  try {
    const tempImageFiles = fs.readdirSync(TEMP_FOLDER_PATH);
    for (let i = 0; i < tempImageFiles.length; i++) {
      fileNames.includes(tempImageFiles[i])
        ? fs.unlinkSync(`${TEMP_FOLDER_PATH}/${tempImageFiles[i]}`)
        : null;
    }
  } catch (err) {
    throw new InteractionError({
      error: `Error deleting temp files`,
      metaData: err,
    });
  }
}

export function deleteTempFilesByTag(interactionTag: number) {
  try {
    const tempImageFiles = fs.readdirSync(TEMP_FOLDER_PATH);
    for (let i = 0; i < tempImageFiles.length; i++) {
      tempImageFiles[i].includes(interactionTag.toString())
        ? fs.unlinkSync(`${TEMP_FOLDER_PATH}/${tempImageFiles[i]}`)
        : null;
    }
  } catch (err) {
    throw new InteractionError({
      error: `Error deleting temp files`,
      metaData: err,
    });
  }
}

export function validateImage(imageAttachment: Attachment, model: imageModelEnums) {
  const supportedImageTypes =
    model === imageModelEnums.DALLE2
      ? ['image/png']
      : ['image/png', 'image/jpg', 'image/webp', 'image/jpeg'];
  const supportedImageSize = model === imageModelEnums.DALLE2 ? 4000000 : 25000000;
  if (!imageAttachment.contentType || !supportedImageTypes.includes(imageAttachment.contentType)) {
    throw new InvalidFileTypeError({
      error: `The image provided must be of type(s) '${supportedImageTypes.join(', ')}'`,
      metaData: imageAttachment,
    });
  }

  if (imageAttachment.size > supportedImageSize) {
    throw new InvalidFileSizeError({
      error: `The Image provided is too large. Images should be no more than ${supportedImageSize / 1000000}MB`,
      metaData: imageAttachment,
    });
  }
}

export function validateJsonContent(data: JsonContent) {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.message === 'string' &&
    typeof data.endChat === 'boolean'
  );
}

export function cleanPGText(textData: string) {
  return textData.replace(/'/g, "''");
}
