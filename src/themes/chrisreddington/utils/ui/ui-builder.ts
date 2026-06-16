import { setTextIfChanged } from '@themes/shared';

import { calculateOpeningPromptX } from '../../config';

export type CountdownUnitKey = 'days' | 'hours' | 'minutes' | 'seconds';
export type ChrisReddingtonDisplayLayout = 'counting' | 'transition' | 'resting';

export interface ChrisReddingtonTimePageElements {
  root: HTMLElement;
  display: HTMLElement;
  chevron: HTMLSpanElement;
  valueGroup: HTMLElement;
  transitionText: HTMLSpanElement;
  cursor: HTMLSpanElement;
  celebrationMessage: HTMLElement;
  days: HTMLSpanElement;
  hours: HTMLSpanElement;
  minutes: HTMLSpanElement;
  seconds: HTMLSpanElement;
}

function createUnitSpan(testId: string): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = 'chrisreddington-digit';
  element.setAttribute('data-testid', testId);
  element.textContent = '00';
  return element;
}

function createSeparator(): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = 'chrisreddington-separator';
  element.setAttribute('aria-hidden', 'true');
  element.textContent = ':';
  return element;
}

function createValueGroup(): {
  group: HTMLElement;
  days: HTMLSpanElement;
  hours: HTMLSpanElement;
  minutes: HTMLSpanElement;
  seconds: HTMLSpanElement;
} {
  const group = document.createElement('span');
  const days = createUnitSpan('countdown-days');
  const hours = createUnitSpan('countdown-hours');
  const minutes = createUnitSpan('countdown-minutes');
  const seconds = createUnitSpan('countdown-seconds');

  group.className = 'chrisreddington-value-group value--numeric';
  group.append(days, createSeparator(), hours, createSeparator(), minutes, createSeparator(), seconds);

  return { group, days, hours, minutes, seconds };
}

function createDisplayLine(): {
  display: HTMLElement;
  chevron: HTMLSpanElement;
  valueGroup: HTMLElement;
  transitionText: HTMLSpanElement;
  cursor: HTMLSpanElement;
  days: HTMLSpanElement;
  hours: HTMLSpanElement;
  minutes: HTMLSpanElement;
  seconds: HTMLSpanElement;
} {
  const display = document.createElement('div');
  const chevron = document.createElement('span');
  const transitionText = document.createElement('span');
  const cursor = document.createElement('span');
  const { group, days, hours, minutes, seconds } = createValueGroup();

  display.className = 'chrisreddington-countdown-display';
  display.setAttribute('data-testid', 'countdown-display');
  display.dataset.layout = 'counting';

  chevron.className = 'chrisreddington-chevron';
  chevron.textContent = '❯';

  transitionText.className = 'chrisreddington-transition-text value--word';
  transitionText.hidden = true;

  cursor.className = 'chrisreddington-cursor';

  display.append(chevron, group, transitionText, cursor);

  return { display, chevron, valueGroup: group, transitionText, cursor, days, hours, minutes, seconds };
}

function createCelebrationMessage(): HTMLElement {
  const message = document.createElement('p');
  message.className = 'chrisreddington-celebration-message';
  message.setAttribute('data-testid', 'celebration-message');
  message.hidden = true;
  return message;
}

export function buildChrisReddingtonTimePageUI(container: HTMLElement): ChrisReddingtonTimePageElements {
  const root = document.createElement('div');
  const {
    display,
    chevron,
    valueGroup,
    transitionText,
    cursor,
    days,
    hours,
    minutes,
    seconds,
  } = createDisplayLine();
  const celebrationMessage = createCelebrationMessage();

  root.className = 'chrisreddington-theme';
  root.append(display, celebrationMessage);

  container.replaceChildren(root);

  return {
    root,
    display,
    chevron,
    valueGroup,
    transitionText,
    cursor,
    celebrationMessage,
    days,
    hours,
    minutes,
    seconds,
  };
}

export function setDisplayLayout(elements: ChrisReddingtonTimePageElements, layout: ChrisReddingtonDisplayLayout): void {
  elements.display.dataset.layout = layout;
  const showValue = layout === 'counting';
  const showTransition = layout === 'transition';
  elements.valueGroup.hidden = !showValue;
  elements.transitionText.hidden = !showTransition;
}

export function setTransitionText(elements: ChrisReddingtonTimePageElements, value: string): void {
  setTextIfChanged(elements.transitionText, value);
}

export function setCelebrationMessage(elements: ChrisReddingtonTimePageElements, message: string): void {
  setTextIfChanged(elements.celebrationMessage, message);
}

export function setAnimationPlayback(elements: ChrisReddingtonTimePageElements, canAnimate: boolean): void {
  elements.root.classList.toggle('is-animations-paused', !canAnimate);
}

export function setCursorBlinking(elements: ChrisReddingtonTimePageElements, shouldBlink: boolean): void {
  elements.cursor.classList.toggle('is-blinking', shouldBlink);
}

export function setRestingFontVariant(elements: ChrisReddingtonTimePageElements, resting: boolean): void {
  elements.display.classList.toggle('is-resting-size', resting);
}

export function updateRestingPromptAlignment(elements: ChrisReddingtonTimePageElements): void {
  const fontSizePx = Number.parseFloat(getComputedStyle(elements.display).fontSize) || 0;
  const promptWidthPx = elements.chevron.getBoundingClientRect().width;
  const promptX = calculateOpeningPromptX(0, promptWidthPx, fontSizePx);
  const offsetPx = Math.abs(promptX);
  elements.display.style.setProperty('--chrisreddington-resting-offset-px', `${offsetPx}px`);
}

export function clearRestingPromptAlignment(elements: ChrisReddingtonTimePageElements): void {
  elements.display.style.removeProperty('--chrisreddington-resting-offset-px');
}
