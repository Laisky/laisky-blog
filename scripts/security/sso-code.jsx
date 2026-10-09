import { consumeSSOCallbackToken } from '../../src/jsx/library/sso';
import { initializeOptionalTelemetry } from '../../src/jsx/library/telemetry';

try {
  await consumeSSOCallbackToken();
  window.fixtureOutcome = 'completed';
} catch {
  window.fixtureOutcome = 'rejected';
}
window.fixtureTelemetry = initializeOptionalTelemetry();
document.body.dataset.ready = 'true';
