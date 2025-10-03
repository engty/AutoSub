import inquirer from 'inquirer';
import InputWithEscPrompt from './input-with-esc.js';
import ListWithEscPrompt from './list-with-esc.js';

export function registerEscPrompts(): void {
  inquirer.registerPrompt('input', InputWithEscPrompt as any);
  inquirer.registerPrompt('list', ListWithEscPrompt as any);
}
