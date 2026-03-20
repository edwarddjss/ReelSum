export function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

export function createExitPromptError() {
    const error = new Error('Prompt cancelled.');
    error.name = 'ExitPromptError';
    return error;
}

export function isExitPromptError(error: unknown) {
    return error instanceof Error && error.name === 'ExitPromptError';
}
