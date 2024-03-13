import * as fs from 'fs'; 
import { DISCORD_MAX_REPLY_STRING_LENGTH, TEMP_FOLDER_PATH } from './constants';
import { BotResponseLengthError, InteractionError, InvalidFileError } from './errors';
import axios from 'axios';

export function generateInteractionTag() {
    return Math.floor(10000 + Math.random() * 90000);
}

export function validateBotResponseLength(response: string) {
    if (response.length > DISCORD_MAX_REPLY_STRING_LENGTH) {
        throw new BotResponseLengthError({
            error: `Bot response exceeds discords limit of 2000 characters`,
            metaData: {
                botResponse: response,
                responseLength: response.length
            }
        });
    }
    return response;
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
            fileNames.includes(tempImageFiles[i]) ? 
                fs.unlinkSync(`${TEMP_FOLDER_PATH}/${tempImageFiles[i]}`) : 
                null;
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
            tempImageFiles[i].includes(interactionTag.toString()) ? 
                fs.unlinkSync(`${TEMP_FOLDER_PATH}/${tempImageFiles[i]}`) : 
                null;
        }
    } catch (err) {
        throw new InteractionError({
            error: `Error deleting temp files`,
            metaData: err,
        });
    }
}