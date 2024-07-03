import { Message } from 'discord.js';
import { OpenAi } from '../..';
import { MessageCreateParams, MessagesPage } from 'openai/resources/beta/threads/messages';
import * as fs from 'fs';
import { TEMP_FOLDER_PATH } from '../../shared/constants';

enum AssistantsRoles {
    USER = 'user',
}

export enum runStatuses {
    QUEUED = 'queued' , 
    IN_PROGRESS = 'in_progress' , 
    REQUIRED_ACTION = 'requires_action' , 
    CANCELLING = 'cancelling' , 
    CANCELLED = 'cancelled' , 
    FAILED = 'failed' , 
    COMPLETED = 'completed' , 
    EXPIRED = 'expired'
}

export default {
    generateAssistantMessage (message: Message, fileIds?: string[]): MessageCreateParams {
        const attachments = fileIds?.map((fileId) => 
            { return {file_id: fileId, tools: [ { type: 'code_interpreter'} ]};}) as MessageCreateParams.Attachment[];

        const assistantMessage: MessageCreateParams = {
            role: AssistantsRoles.USER,
            content: message.content,
            attachments,
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

    processAssistantRunMessages(messages: MessagesPage, runId: string) {
        let botResponse = '';
        const fileIds: string[] = [];
        const filteredThreadMsgs = messages.data.filter(msg => {
            return msg.role === 'assistant' && msg.run_id === runId && msg.content[0].type === 'text';
        });

        for (let i = 0; i < filteredThreadMsgs.length; i++) {
            
            const { content, attachments } = filteredThreadMsgs[i];
            if (content[0].type === 'text') {
                botResponse += `${content[0].text.value}\n`;
                if (attachments && attachments.length > 0) {
                    const fileId = attachments[0].file_id;
                    fileIds.push(fileId as string);
                }
            }
        }
        
        return {botResponse, fileIds} ;
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