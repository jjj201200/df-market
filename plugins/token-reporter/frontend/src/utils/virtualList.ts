import type {Virtualizer} from '@tanstack/react-virtual';

/**
 * Module-level handle to the ConversationList virtualizer.
 *
 * The scroll<->brush sync (useScrollSync.ts / scroll.ts) needs to read
 * measured row positions and scroll to rows that may not be rendered.
 * Those modules are plain functions (no React context), so the virtualizer
 * instance is registered here by ConversationList on mount.
 */
let _virtualizer: Virtualizer<HTMLElement, Element> | null = null;

export function setConversationVirtualizer(v: Virtualizer<HTMLElement, Element> | null) {
  _virtualizer = v;
}

export function getConversationVirtualizer() {
  return _virtualizer;
}
