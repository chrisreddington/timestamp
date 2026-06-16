import type { AnimationStateGetter } from '@core/types';
import { shouldEnableAnimations } from '@themes/shared';

function createAmbientLine(): HTMLElement {
  const line = document.createElement('div');
  const chevron = document.createElement('span');
  const cursor = document.createElement('span');

  line.className = 'chrisreddington-landing-line';
  chevron.className = 'chrisreddington-chevron';
  cursor.className = 'chrisreddington-cursor is-blinking';

  chevron.textContent = '❯';
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
