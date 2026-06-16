import type { AnimationStateGetter } from '@core/types';
import { shouldEnableAnimations } from '@themes/shared';
const SVG_NS = 'http://www.w3.org/2000/svg';

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

function createAmbientLine(): HTMLElement {
  const line = document.createElement('div');
  const chevron = createChevronElement();
  const cursor = document.createElement('span');

  line.className = 'chrisreddington-landing-line';
  cursor.className = 'chrisreddington-cursor is-blinking';
  line.append(chevron, cursor);

  return line;
}

export interface ChrisReddingtonLandingAmbientElements {
  wrapper: HTMLElement;
  line: HTMLElement;
}

export function createLandingAmbient(container: HTMLElement): ChrisReddingtonLandingAmbientElements {
  const wrapper = document.createElement('div');
  const line = createAmbientLine();

  wrapper.className = 'chrisreddington-landing-ambient';
  wrapper.append(line);
  container.replaceChildren(wrapper);

  return { wrapper, line };
}

export function updateLandingAmbientMotion(
  elements: ChrisReddingtonLandingAmbientElements,
  getAnimationState: AnimationStateGetter
): void {
  const canAnimate = shouldEnableAnimations(getAnimationState);
  elements.line.classList.toggle('is-breathing', canAnimate);
  elements.wrapper.classList.toggle('is-paused', !canAnimate);
}

export function positionLandingAmbient(
  elements: ChrisReddingtonLandingAmbientElements,
  container: HTMLElement,
  exclusionElement?: HTMLElement
): void {
  const fallbackTop = '50%';
  if (!exclusionElement) {
    elements.line.style.top = fallbackTop;
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const exclusionRect = exclusionElement.getBoundingClientRect();
  const centeredTopPx = exclusionRect.top - containerRect.top + exclusionRect.height / 2;
  const viewportCenterPx = containerRect.height / 2;
  const maxOffsetPx = containerRect.height * 0.1;
  const boundedCenterPx = Math.min(
    Math.max(centeredTopPx, viewportCenterPx - maxOffsetPx),
    viewportCenterPx + maxOffsetPx
  );
  const boundedTop = Math.min(Math.max(48, boundedCenterPx), containerRect.height - 48);
  elements.line.style.top = `${boundedTop}px`;
}
