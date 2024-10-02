import { OpenAi } from '../..';
import * as fs from 'fs';

export type fileUploadPurpose = 'fine-tune' | 'assistants';

export default {
  async uploadFile(filePath: string, purpose: fileUploadPurpose) {
    const fileObject = await OpenAi.files.create({
      file: fs.createReadStream(filePath),
      purpose,
    });

    return fileObject;
  },
};
