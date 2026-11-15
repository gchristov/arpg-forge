import type { Command } from '../sim/state';

/** Sends `command` when the button is pressed, without the press also reaching the game as a tap. */
export function bindCommand(button: HTMLElement, command: Command, send: (command: Command) => void): void {
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    send(command);
  });
}
