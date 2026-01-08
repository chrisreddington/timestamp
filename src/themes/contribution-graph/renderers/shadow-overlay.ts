import { calculateShadowInfo } from '@core/solar/shadow';

interface GeoCoords {
  latitude: number;
  longitude: number;
}

export interface ShadowOverlayController {
  destroy(): void;
}

const MIN_HEIGHT = 0.05;
const MAX_HEIGHT = 5;
const REFERENCE_HEIGHT_METERS = 1;
const MIN_SCALE = 0.25; // 0.25x of reference visually
const MAX_SCALE = 3;    // 3x of reference visually

export function createShadowOverlay(parent: HTMLElement): ShadowOverlayController {
  const overlay = document.createElement('div');
  overlay.className = 'cg-shadow-overlay';
  overlay.setAttribute('data-testid', 'cg-shadow-overlay');

  const title = document.createElement('div');
  title.className = 'cg-shadow-title';
  title.textContent = 'Shadow & Sun';

  const form = document.createElement('div');
  form.className = 'cg-shadow-form';

  const heightLabel = document.createElement('label');
  heightLabel.textContent = 'Object height (m)';
  heightLabel.className = 'cg-shadow-label';
  heightLabel.setAttribute('for', 'cg-shadow-height');

  const heightInput = document.createElement('input');
  heightInput.id = 'cg-shadow-height';
  heightInput.type = 'number';
  heightInput.min = String(MIN_HEIGHT);
  heightInput.max = String(MAX_HEIGHT);
  heightInput.step = '0.05';
  heightInput.value = '1.00';
  heightInput.className = 'cg-shadow-input';

  const status = document.createElement('div');
  status.className = 'cg-shadow-status';
  status.textContent = 'Requesting location…';

  const results = document.createElement('div');
  results.className = 'cg-shadow-results';
  results.innerHTML = `
    <div class="cg-shadow-metric"><span>Shadow:</span><strong data-field="shadow">–</strong></div>
    <div class="cg-shadow-metric"><span>Altitude:</span><strong data-field="altitude">–</strong></div>
    <div class="cg-shadow-metric"><span>Azimuth:</span><strong data-field="azimuth">–</strong></div>
    <div class="cg-shadow-metric"><span>Time:</span><strong data-field="time">–</strong></div>
  `;

  const visual = document.createElement('div');
  visual.className = 'cg-shadow-visual';
  visual.innerHTML = `
    <div class="cg-shadow-ground"></div>
    <div class="cg-shadow-object" data-field="object"></div>
    <div class="cg-shadow-shadow" data-field="shadow-bar"></div>
    <div class="cg-shadow-scale">
      <div class="cg-scale-track"></div>
      <div class="cg-scale-tick" data-tick="0.5">0.5×</div>
      <div class="cg-scale-tick" data-tick="1">1×</div>
      <div class="cg-scale-tick" data-tick="2">2×</div>
    </div>
  `;

  const sizeMeter = document.createElement('div');
  sizeMeter.className = 'cg-size-meter';
  sizeMeter.innerHTML = `
    <div class="cg-size-meter-bar" data-field="size-meter-bar"></div>
    <div class="cg-size-meter-label">ref = ${REFERENCE_HEIGHT_METERS.toFixed(2)} m</div>
  `;

  form.append(heightLabel, heightInput);
  overlay.append(title, form, status, results, visual, sizeMeter);
  parent.appendChild(overlay);

  let coords: GeoCoords | null = null;
  const listeners: Array<{ target: EventTarget; type: string; handler: EventListener }> = [];

  function setStatus(text: string): void {
    status.textContent = text;
  }

  function setField(field: string, value: string): void {
    const el = results.querySelector(`[data-field="${field}"]`);
    if (el) el.textContent = value;
  }

  function updateVisual(heightMeters: number, shadowLength: number | null): void {
    const objectEl = visual.querySelector('[data-field="object"]') as HTMLElement;
    const shadowEl = visual.querySelector('[data-field="shadow-bar"]') as HTMLElement;
    // Normalize visual height to reference (do not render true height)
    const ratio = heightMeters / REFERENCE_HEIGHT_METERS;
    const clampedScale = Math.min(Math.max(ratio, MIN_SCALE), MAX_SCALE);
    objectEl.style.setProperty('--cg-object-scale', String(clampedScale));

    if (shadowLength === null) {
      shadowEl.classList.add('is-hidden');
      return;
    }

    shadowEl.classList.remove('is-hidden');
    const shadowPx = Math.min(shadowLength * 40, 220);
    shadowEl.style.setProperty('--cg-shadow-length', `${shadowPx}px`);

    // Update size meter as a proportion of MAX_SCALE
    const bar = overlay.querySelector('[data-field="size-meter-bar"]') as HTMLElement | null;
    if (bar) {
      const percent = Math.min(clampedScale / MAX_SCALE, 1) * 100;
      bar.style.width = `${percent}%`;
      bar.setAttribute('aria-valuenow', percent.toFixed(0));
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('role', 'progressbar');
    }
  }

  function update(): void {
    const heightMeters = Number(heightInput.value);
    if (!coords) {
      setField('shadow', 'Location needed');
      setField('altitude', '–');
      setField('azimuth', '–');
      setField('time', '–');
      updateVisual(heightMeters, null);
      return;
    }

    if (!Number.isFinite(heightMeters) || heightMeters < MIN_HEIGHT) {
      setField('shadow', `Enter ≥ ${MIN_HEIGHT} m`);
      updateVisual(heightMeters, null);
      return;
    }

    const now = new Date();
    const result = calculateShadowInfo({
      heightMeters,
      latitude: coords.latitude,
      longitude: coords.longitude,
      date: now,
    });

    const shadowText = result.shadowLengthMeters === null
      ? 'Sun below horizon'
      : `${result.shadowLengthMeters.toFixed(2)} m`;

    setField('shadow', shadowText);
    setField('altitude', `${result.altitudeDeg.toFixed(1)}°`);
    setField('azimuth', `${result.azimuthDeg.toFixed(1)}°`);
    setField('time', now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setStatus(`Lat ${coords.latitude.toFixed(4)}, Lon ${coords.longitude.toFixed(4)}`);
    updateVisual(heightMeters, result.shadowLengthMeters);
  }

  function handleGeoSuccess(position: GeolocationPosition): void {
    coords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    setStatus('Location detected');
    update();
  }

  function handleGeoError(): void {
    coords = null;
    setStatus('Location permission needed');
    setField('shadow', 'Location required');
    setField('altitude', '–');
    setField('azimuth', '–');
    setField('time', '–');
    updateVisual(Number(heightInput.value), null);
  }

  function requestLocation(): void {
    if (!navigator.geolocation) {
      handleGeoError();
      return;
    }
    setStatus('Requesting location…');
    navigator.geolocation.getCurrentPosition(handleGeoSuccess, handleGeoError, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 15_000,
    });
  }

  function addListener(target: EventTarget, type: string, handler: EventListener): void {
    target.addEventListener(type, handler);
    listeners.push({ target, type, handler });
  }

  addListener(heightInput, 'input', update as EventListener);
  requestLocation();

  function destroy(): void {
    overlay.remove();
    listeners.forEach(({ target, type, handler }) => target.removeEventListener(type, handler));
    listeners.length = 0;
  }

  return { destroy };
}
