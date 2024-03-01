import { Message } from "discord.js";
import { OpenAi } from "../..";
import { ThreadMessagesPage } from "openai/resources/beta/threads/messages/messages";
import * as fs from 'fs';
import { TEMP_FOLDER_PATH } from "../../shared/constants";


export interface AssistantsMessage {
    role: AssistantsRoles;
    content: string;

}

enum AssistantsRoles {
    USER = 'user',
}

export enum runStatuses {
    QUEUED = "queued" , 
    IN_PROGRESS = "in_progress" , 
    REQUIRED_ACTION = "requires_action" , 
    CANCELLING = "cancelling" , 
    CANCELLED = "cancelled" , 
    FAILED = "failed" , 
    COMPLETED = "completed" , 
    EXPIRED = "expired"
}

export default {
    generateAssistantMessage (message: Message): AssistantsMessage {
        const assistantMessage: AssistantsMessage = {
            role: AssistantsRoles.USER,
            content: message.content,
        };
    
        return assistantMessage;
    },

    async getAssistantRunStatus(threadId: string, runId: string): Promise<runStatuses> {
        const { status } = await OpenAi.beta.threads.runs.retrieve(
            threadId,
            runId,
        );

        return status as runStatuses;
    },

    processAssistantRunMessages(messages: ThreadMessagesPage) {
        let botResponse = '';
        const fileIds: string[][] = [];
        for (const data of messages.data) {
            
            const { content, file_ids } = data;
            if (data.role === 'assistant' && content[0].type === 'text') {
                botResponse += `${content[0].text.value}\n`;
                fileIds.push(file_ids);
            }
        }

        const combinedFileIds = fileIds.reduce((acc, curr) => acc.concat(curr), []);
        
        return {botResponse, combinedFileIds} ;
    },

    async processAssistantRunFiles(fileIds: string[], userName: string, interactionTag: number) {
        for (const fileId of fileIds) {
            const fileData = await Promise.all([OpenAi.files.retrieve(fileId), OpenAi.files.content(fileId)]);

            const fileName = fileData[0].filename;
            const file = fileData[1];

            const bufferView = new Uint8Array(await file.arrayBuffer());

            const regex = /\/([^/]+)$/;
            const match = fileName.match(regex);
            const endingFilePath = match ? match[1] : null;
            
            if (endingFilePath) {
                const filePath = `${TEMP_FOLDER_PATH}/${userName}-${interactionTag}-${endingFilePath}`;
                fs.writeFileSync(filePath, bufferView);
            }

        }
    }
};