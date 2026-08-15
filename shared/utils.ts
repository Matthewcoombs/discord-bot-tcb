import * as fs from 'fs';
import { TEMP_FOLDER_PATH } from './constants';
import {
  InteractionError,
  InvalidFileError,
  InvalidFileSizeError,
  InvalidFileTypeError,
} from './errors';
import axios from 'axios';
import { Attachment, Message } from 'discord.js';
import { JsonContent } from '../openAIClient/chatCompletion/chatCompletion.service';
import { config } from '../config';

export function generateInteractionTag() {
  return Math.floor(10000 + Math.random() * 90000);
}

/**
 * Returns the id of the most recent (latest) non-bot message that carries an
 * image attachment, or undefined if none exists.
 *
 * This is used to avoid re-sending vision content for every message in a
 * conversation. Images are expensive to tokenize, and the whole transcript is
 * reformatted and re-sent on every turn, so only the latest image-bearing
 * message should retain its image content. Older images are dropped from the
 * model payload (their text is preserved). Image editing is unaffected because
 * the edit handlers read attachments directly from the raw collected messages.
 */
/**
 * Applies a sliding context window to a transcript before it is sent to the
 * model. Keeps only the most recent `maxMessages` messages so within-session
 * prompt size stays bounded instead of growing on every turn.
 *
 * Leading bot messages are trimmed so the window begins on a user message. This
 * satisfies Anthropic's requirement that a conversation start with the user
 * role, and avoids an orphaned tool_use/tool_result pair at the window edge.
 *
 * This is for the live model request only. It must NOT be used when building
 * retention data, which is capped separately by the profile's retentionSize.
 */
export function applyContextWindow(
  messages: Message[],
  maxMessages: number = config.messageContextWindowSize,
): Message[] {
  if (messages.length <= maxMessages) {
    return messages;
  }
  const windowed = messages.slice(messages.length - maxMessages);
  const firstUserIndex = windowed.findIndex(msg => !msg.author.bot);
  return firstUserIndex > 0 ? windowed.slice(firstUserIndex) : windowed;
}

export function getLatestImageMessageId(messages: Message[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg.author.bot && msg.attachments.some(att => att.contentType?.startsWith('image/'))) {
      return msg.id;
    }
  }
  return undefined;
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

export function validateImage(imageAttachment: Attachment) {
  const supportedImageTypes = ['image/png', 'image/jpg', 'image/webp', 'image/jpeg'];
  const supportedImageSize = 25000000;
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
