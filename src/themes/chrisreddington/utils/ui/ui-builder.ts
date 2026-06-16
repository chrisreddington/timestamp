import type { ResourceTracker } from '@core/types';
import { safeRequestAnimationFrame, setTextIfChanged, trackListener } from '@themes/shared';

import { calculateOpeningPromptX, CHRISREDDINGTON_INK_SAMPLES, inkCenterNudgeEm } from '../../config';

export type CountdownUnitKey = 'days' | 'hours' | 'minutes' | 'seconds';
export type ChrisReddingtonDisplayLayout = 'counting' | 'transition' | 'resting';
const SVG_NS = 'http://www.w3.org/2000/svg';

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

/**
 * Builds the prompt chevron as an inline SVG rather than a typed `❯` glyph.
 *
 * @remarks
 * A font glyph paints its ink asymmetrically inside the line box, so flex
 * `align-items: center` centres the box, not the visible chevron — leaving it
 * visibly high or low against the geometric cursor block across the clamp() font
 * range. The SVG path is centred on a symmetric viewBox, so its box centre and
 * ink centre coincide and it lands exactly on the cursor's row axis.
 */
function createChevronElement(): HTMLSpanElement {
  const chevron = document.createElement('span');
  const icon = document.createElementNS(SVG_NS, 'svg');
  const path = document.createElementNS(SVG_NS, 'path');

  chevron.className = 'chrisreddington-chevron';
  icon.setAttribute('class', 'chrisreddington-chevron-icon');
  icon.setAttribute('viewBox', '0 0 12 14');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('d', 'M2 2 L10 7 L2 12');
  icon.append(path);
  chevron.append(icon);

  return chevron;
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
  const chevron = createChevronElement();
  const transitionText = document.createElement('span');
  const cursor = document.createElement('span');
  const { group, days, hours, minutes, seconds } = createValueGroup();

  display.className = 'chrisreddington-countdown-display';
  display.setAttribute('data-testid', 'countdown-display');
  display.dataset.layout = 'counting';

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

let inkMeasureCanvas: HTMLCanvasElement | null = null;

function getInkMeasureContext(): CanvasRenderingContext2D | null {
  inkMeasureCanvas ??= document.createElement('canvas');
  return inkMeasureCanvas.getContext('2d');
}

function measureSampleNudgeEm(
  context: CanvasRenderingContext2D,
  font: string,
  fontSizePx: number,
  sample: string,
  capBandOnly: boolean
): number {
  context.font = font;
  context.textBaseline = 'alphabetic';
  const metrics = context.measureText(sample);

  return inkCenterNudgeEm({
    fontSizePx,
    fontBoundingBoxAscent: metrics.fontBoundingBoxAscent ?? 0,
    fontBoundingBoxDescent: metrics.fontBoundingBoxDescent ?? 0,
    actualBoundingBoxAscent: metrics.actualBoundingBoxAscent ?? 0,
    actualBoundingBoxDescent: capBandOnly ? 0 : metrics.actualBoundingBoxDescent ?? 0,
  });
}

/**
 * Measures the rendered font and applies per-content vertical nudges so digit
 * and word ink centres land on the cursor's row axis.
 *
 * @remarks
 * Numerics are centred on their full ink box; the end-word is centred on its
 * cap/x-height band (descender excluded) so it reads on the same row as the
 * digits rather than being dragged down by the `y` tail.
 */
export function applyInkCentering(elements: ChrisReddingtonTimePageElements): void {
  const context = getInkMeasureContext();
  if (!context) {
    return;
  }

  const style = getComputedStyle(elements.display);
  const fontSizePx = Number.parseFloat(style.fontSize) || 0;
  if (fontSizePx <= 0) {
    return;
  }

  const font = `${style.fontWeight} ${fontSizePx}px ${style.fontFamily}`;
  const numericNudgeEm = measureSampleNudgeEm(context, font, fontSizePx, CHRISREDDINGTON_INK_SAMPLES.numeric, false);
  const wordNudgeEm = measureSampleNudgeEm(context, font, fontSizePx, CHRISREDDINGTON_INK_SAMPLES.wordXHeight, true);

  elements.display.style.setProperty('--chrisreddington-numeric-nudge', `${numericNudgeEm}em`);
  elements.display.style.setProperty('--chrisreddington-word-nudge', `${wordNudgeEm}em`);
}

/**
 * Wires ink centering to run now, after web fonts load, and on viewport resize,
 * registering the resize listener for cleanup via the resource tracker.
 */
export function setupInkCentering(elements: ChrisReddingtonTimePageElements, tracker: ResourceTracker): void {
  const run = (): void => applyInkCentering(elements);

  run();

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    void document.fonts.ready.then(run).catch(() => undefined);
  }

  const onResize = (): void => {
    safeRequestAnimationFrame(run, tracker);
  };
  window.addEventListener('resize', onResize);
  trackListener(() => window.removeEventListener('resize', onResize), tracker);
}
