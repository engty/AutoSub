import { filter, take, takeUntil } from 'rxjs';
import ListPrompt from 'inquirer/lib/prompts/list.js';
import observe from 'inquirer/lib/utils/events.js';
import { PromptCancelledError } from './prompt-cancel-error.js';
import { ESC_HINT_TEXT } from './esc-hint.js';

export default class ListWithEscPrompt extends ListPrompt {
  _run(resolve: (value: any) => void, reject?: (reason: unknown) => void) {
    const prompt = super._run(resolve as any);

    const events = observe(this.rl);
    const esc$ = events.keypress.pipe(
      takeUntil(events.line),
      filter(({ key }) => key?.name === 'escape'),
      take(1),
    );

    const subscription = esc$.subscribe(() => {
      subscription.unsubscribe();
      this.status = 'aborted';
      this.screen.done();
      this.close();
      this.rl.close();
      reject?.(new PromptCancelledError());
    });

    return prompt;
  }

  render() {
    const originalRender = this.screen.render.bind(this.screen);
    this.screen.render = (message: string, bottomContent?: string) => {
      const hint = this.status === 'answered' ? '' : ESC_HINT_TEXT;
      const hasHint = bottomContent && bottomContent.includes('(按 Esc 返回)');
      const finalBottom: string = hint
        ? hasHint
          ? bottomContent ?? ''
          : bottomContent
          ? `${bottomContent}${hint}`
          : hint
        : bottomContent ?? '';
      originalRender(message, finalBottom);
    };

    try {
      super.render();
    } finally {
      this.screen.render = originalRender;
    }
  }
}
