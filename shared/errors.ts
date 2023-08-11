export const INTERACTION_ERROR_CODE =`i-100`;
export const USER_TIMEOUT_CODE = `i-101`;
export const INVALID_FILE_CODE = `if-100`;
export const INVALID_FILE_SIZE_CODE = `if-101`;
export const INVALID_FILE_TYPE_CODE = `if-102`;

type baseError = {
        error: string;
        code?: string;
        metaData?: any;
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