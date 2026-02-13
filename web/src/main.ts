import "./style.css";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app root");
}

app.innerHTML = `
  <div class="container">
    <div class="card">
      <h1 class="title">Nkokan (Phase 2 harness)</h1>
      <p class="subtitle">
        Web/PWA scaffolding is in place. Next: bundle loading, JS normalization parity, and minimal offline lookup UI.
      </p>
      <p class="subtitle" style="margin-top: 12px">
        See <code>docs/ROADMAP.md</code> for the Phase 2.0 ordering.
      </p>
    </div>
  </div>
`;

