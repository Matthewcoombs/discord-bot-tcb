export const INTERACTION_ERROR_CODE = `i-100`;
export const USER_TIMEOUT_CODE = `i-101`;
export const INVALID_FILE_CODE = `if-100`;
export const INVALID_FILE_SIZE_CODE = `if-101`;
export const INVALID_FILE_TYPE_CODE = `if-102`;
export const INVALID_RESPONSE_LENGTH_CODE = `ir-100`;
export const EMAIL_SEND_ERROR = `es-100`;

type baseError = {
  error: string;
  code?: string;
  metaData?: any;
};

export class BotResponseLengthError {
  errorData: baseError;
  constructor(errorData: baseError) {
    this.errorData = errorData;
    this.errorData.code = INVALID_RESPONSE_LENGTH_CODE;
  }
}

export class InteractionError {
  errorData: baseError;
  constructor(errorData: baseError) {
    this.errorData = errorData;
    this.errorData.code = INTERACTION_ERROR_CODE;
  }
}

export class InteractionTimeOutError {
  errorData: baseError;
  constructor(errorData: baseError) {
    this.errorData = errorData;
    this.errorData.code = USER_TIMEOUT_CODE;
  }
}

export class InvalidFileError {
  errorData: baseError;
  constructor(errorData: baseError) {
    this.errorData = errorData;
    this.errorData.code = INVALID_FILE_CODE;
  }
}

export class InvalidFileSizeError {
  errorData: baseError;
  constructor(errorData: baseError) {
    this.errorData = errorData;
    this.errorData.code = INVALID_FILE_SIZE_CODE;
  }
}

export class InvalidFileTypeError {
  errorData: baseError;
  constructor(errorData: baseError) {
    this.errorData = errorData;
    this.errorData.code = INVALID_FILE_TYPE_CODE;
  }
}

export class EmailSendError {
  errorData: baseError;
  constructor(errorData: baseError) {
    this.errorData = errorData;
    this.errorData.code = EMAIL_SEND_ERROR;
  }
}
