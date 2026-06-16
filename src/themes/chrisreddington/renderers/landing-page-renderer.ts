import type {
  AnimationStateContext,
  AnimationStateGetter,
  LandingPageRenderer,
  MountContext,
} from '@core/types';
import { DEFAULT_ANIMATION_STATE } from '@themes/shared';

import {
  type ChrisReddingtonLandingAmbientElements,
  createLandingAmbient,
  positionLandingAmbient,
  updateLandingAmbientMotion,
} from '../utils/landing-page/ambient';

interface ChrisReddingtonLandingRendererState {
  container: HTMLElement | null;
  elements: ChrisReddingtonLandingAmbientElements | null;
  exclusionElement: HTMLElement | undefined;
  getAnimationState: AnimationStateGetter;
  isDestroyed: boolean;
}

function createLandingRendererState(): ChrisReddingtonLandingRendererState {
  return {
    container: null,
    elements: null,
    exclusionElement: undefined,
    getAnimationState: () => DEFAULT_ANIMATION_STATE,
    isDestroyed: false,
  };
}

function updateLandingState(state: ChrisReddingtonLandingRendererState): void {
  if (!state.container || !state.elements) {
    return;
  }

  updateLandingAmbientMotion(state.elements, state.getAnimationState);
  positionLandingAmbient(state.elements, state.container, state.exclusionElement);
}

export function chrisreddingtonLandingPageRenderer(_container: HTMLElement): LandingPageRenderer {
  const state = createLandingRendererState();

  return {
    mount(container: HTMLElement, context?: MountContext): void {
      if (state.isDestroyed) {
        return;
      }

      state.container = container;
      state.getAnimationState = context?.getAnimationState ?? state.getAnimationState;
      state.exclusionElement = context?.exclusionElement;
      state.elements = createLandingAmbient(container);
      updateLandingState(state);
    },

    setSize(_width: number, _height: number): void {
      updateLandingState(state);
    },

    onAnimationStateChange(context: AnimationStateContext): void {
      state.getAnimationState = () => context;
      updateLandingState(state);
    },

    destroy(): void {
      state.isDestroyed = true;
      state.container?.replaceChildren();
      state.container = null;
      state.elements = null;
      state.exclusionElement = undefined;
    },

    getElementCount(): { total: number; animated: number } {
      if (!state.elements) {
        return { total: 0, animated: 0 };
      }

      const animated = state.elements.line.classList.contains('is-breathing') ? 1 : 0;
      return { total: 2, animated };
    },
  };
}
