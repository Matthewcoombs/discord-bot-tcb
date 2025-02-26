// @ts-nocheck
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageCollector,
  Message,
  InteractionReplyOptions,
  Collection,
  Attachment,
  User,
} from 'discord.js';
import {
  Command,
  singleInstanceCommandsEnum,
} from '../../shared/discord-js-types';
import userProfilesDao from '../../database/user_profiles/userProfilesDao';
import { OpenAi } from '../..';
import {
  DEFAULT_CHAT_TIMEOUT,
  TEMP_FOLDER_PATH,
  generateAssistantIntroCopy,
} from '../../shared/constants';
import assistantsService from '../../openAIClient/assistants/assistants.service';
import * as fs from 'fs';
import {
  createTempFile,
  deleteTempFilesByTag,
  generateInteractionTag,
  getRemoteFileBufferData,
  processBotResponseLength,
} from '../../shared/utils';
import filesService from '../../openAIClient/files/files.service';

async function processAttachedFiles(
  user: User,
  attachments: Collection<string, Attachment>,
  interactionTag: number,
) {
  let fileIds: string[] = [];
  if (attachments.size > 0) {
    const asyncFileDataRetrievalList = attachments.map((attachment) => {
      return getRemoteFileBufferData(attachment.url);
    });

    const bufferDataList = await Promise.all(asyncFileDataRetrievalList);
    const tempFilePaths: string[] = [];
    for (let i = 0; i < bufferDataList.length; i++) {
      const tempFileName = `${user.username}-assistant-${interactionTag}-${i + 1}`;
      const filePath = createTempFile(bufferDataList[i], tempFileName);
      tempFilePaths.push(filePath);
    }

    const asyncOpenAiFileUpload = tempFilePaths.map((filePath) => {
      return filesService.uploadFile(filePath, 'assistants');
    });

    const fileObjects = await Promise.all(asyncOpenAiFileUpload);
    fileIds = fileObjects.map((fileObject) => fileObject.id);
  }
  return fileIds;
}

const assistantCommand: Command = {
  data: new SlashCommandBuilder()
    .setName(singleInstanceCommandsEnum.ASSISTANT)
    .setDescription('Speak to your personal assistant for support'),
  async execute(interaction: ChatInputCommandInteraction) {
    const interactionTag = generateInteractionTag();
    try {
      const { user } = interaction;
      const selectedProfile = await userProfilesDao.getSelectedProfile(user.id);
      if (!selectedProfile) {
        interaction.client.singleInstanceCommands.delete(interaction.id);
        return interaction.reply({
          content: `:exclamation: You do not have any profile selected to use the assistant service at this time`,
          ephemeral: true,
        });
      }

      await interaction.reply({
        content: generateAssistantIntroCopy(
          selectedProfile.name,
          user.username,
        ),
        ephemeral: true,
      });

      const thread = await OpenAi.beta.threads.retrieve(
        selectedProfile.threadId,
      );
      const collectorFilter = (colMsg: Message) =>
        // collect message if the message is coming from the user who initiated
        colMsg.author.id === user.id;
      const collector = interaction?.channel?.createMessageCollector({
        filter: collectorFilter,
      }) as MessageCollector;
      const timeout = selectedProfile.timeout
        ? Number(selectedProfile.timeout)
        : DEFAULT_CHAT_TIMEOUT;
      const userResponseTimeout = setTimeout(async () => {
        collector.stop();
        await interaction.followUp(
          `Looks like you're no longer there ${interaction.user.username}. The assistant session has ended.`,
        );
      }, timeout);

      let isProcessing = false;
      collector.on('collect', async (message) => {
        if (!isProcessing) {
          userResponseTimeout.refresh();
          const isUserMsg = !message.author.bot;
          const isTerminationMsg =
            message.content.toLowerCase() === 'goodbye' && isUserMsg;
          // checking for attached files to process and upload
          const attachedFileIds = await processAttachedFiles(
            user,
            message.attachments,
            interactionTag,
          );
          const assistantMessage = assistantsService.generateAssistantMessage(
            message,
            attachedFileIds,
          );
          await OpenAi.beta.threads.messages.create(
            thread.id,
            assistantMessage,
          );
          isProcessing = true;
          const run = await OpenAi.beta.threads.runs.createAndPoll(
            thread.id,
            {
              assistant_id: selectedProfile.assistantId,
              instructions: selectedProfile.profile,
            },
            { pollIntervalMs: 500 },
          );
          isProcessing = false;

          if (run.status === 'completed') {
            const messages = await OpenAi.beta.threads.messages.list(thread.id);
            const { botResponse, fileIds } =
              assistantsService.processAssistantRunMessages(messages, run.id);

            let botResponseFiles: string[] = [];
            if (fileIds.length > 0) {
              await assistantsService.processAssistantRunFiles(
                fileIds,
                user.username,
                interactionTag,
              );
              botResponseFiles = fs.readdirSync(TEMP_FOLDER_PATH);
              botResponseFiles = botResponseFiles
                .filter(
                  (fileName) =>
                    fileName.includes(user.username) &&
                    fileName.includes(interactionTag.toString()),
                )
                .map((fileName) => `${TEMP_FOLDER_PATH}/${fileName}`);
            }

            const responses = processBotResponseLength(botResponse);
            for (let i = 0; i < responses.length; i++) {
              const resPayload: InteractionReplyOptions = {
                content: responses[i],
              };
              if (i === responses.length - 1 && botResponseFiles) {
                resPayload.files = botResponseFiles;
              }
              await interaction.followUp(resPayload);
            }
            deleteTempFilesByTag(interactionTag);
            if (isTerminationMsg) {
              collector.stop();
            }
          }
        } else {
          await interaction.followUp({
            content: `Hold on I'm still processing your previous message :thought_balloon:...`,
            ephemeral: true,
          });
        }
      });

      collector.on('end', (collected) => {
        console.log(
          `The assistant has been terminated - [interactionTag]: ${interactionTag}`,
        );
        interaction.deleteReply();
        deleteTempFilesByTag(interactionTag);
        clearTimeout(userResponseTimeout);
        collected.clear();
        interaction.client.singleInstanceCommands.delete(interaction.id);
      });
    } catch (error: any) {
      await interaction.deleteReply();
      deleteTempFilesByTag(interactionTag);
      const errorMessage = `Sorry there was an error in the assistant service.`;
      await interaction.followUp({
        content: errorMessage,
        ephemeral: true,
      });
      interaction.client.singleInstanceCommands.delete(interaction.id);
    }
  },
};

export = assistantCommand;
