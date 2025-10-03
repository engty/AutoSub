export class PromptCancelledError extends Error {
  constructor() {
    super('prompt_cancelled');
    this.name = 'PromptCancelledError';
  }
}
