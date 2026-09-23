import gsap from 'gsap';

export async function renderAnalyticsStage(container, state) {
  // Show loading
  container.innerHTML = `
    <div class="h-full w-full flex items-center justify-center p-8 pointer-events-auto">
      <div class="text-slate-500 font-mono text-sm animate-pulse">LOADING DASHBOARD...</div>
    </div>
  `;

  let apiDash;
  try {
    apiDash = await window.EvalOS.apiClient.getAnalyticsDashboard();
  } catch (err) {
    console.error("Failed to load analytics dashboard", err);
  }

  container.innerHTML = '';
  // Create overlay container
  const overlay = document.createElement('div');
  overlay.className = 'glass-panel p-6 rounded-2xl bg-ivory/95 backdrop-blur-lg shadow-xl border border-slateink/10 pointer-events-auto w-full max-w-5xl mx-auto mt-8';

  const dash = apiDash || {
    assessment: { scripts_received: 'NO DATA', scripts_evaluated: 'NO DATA', pending: 'NO DATA', blocked: 'NO DATA', verified: 'NO DATA', moderated: 'NO DATA', result_ready: 'NO DATA' },
    examiner: { average_evaluation_time_mins: 'NO DATA', review_signals_generated: 'NO DATA' },
    anomalies: { q04_discrepancy_rate: 'NO DATA', unanswered_rate: 'NO DATA' }
  };
  
  const completion = dash.assessment.scripts_received > 0 
      ? Math.round((dash.assessment.scripts_evaluated / dash.assessment.scripts_received) * 100) 
      : 0;

  overlay.innerHTML = `
    <h2 class="text-headline-lg text-slateink mb-4">Institutional Analytics & Learning</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="p-4 bg-surface-glass rounded-xl shadow-sm">
        <h3 class="text-title-md text-slateink mb-2">Evaluation Progress</h3>
        <p class="text-body-md text-slateink/80"><strong>Received:</strong> ${dash.assessment.scripts_received}</p>
        <p class="text-body-md text-slateink/80"><strong>Checked:</strong> ${dash.assessment.scripts_evaluated}</p>
        <p class="text-body-md text-slateink/80"><strong>Pending:</strong> ${dash.assessment.pending}</p>
        <p class="text-body-md text-slateink/80"><strong>Completion:</strong> ${completion}%</p>
      </div>
      <div class="p-4 bg-surface-glass rounded-xl shadow-sm">
        <h3 class="text-title-md text-slateink mb-2">Quality Metrics</h3>
        <p class="text-body-md text-slateink/80"><strong>Avg Eval Time:</strong> ${dash.examiner.average_evaluation_time_mins} mins</p>
        <p class="text-body-md text-slateink/80"><strong>Review Signals:</strong> ${dash.examiner.review_signals_generated}</p>
        <p class="text-body-md text-slateink/80"><strong>Discrepancy Rate:</strong> ${(dash.anomalies.q04_discrepancy_rate * 100).toFixed(1)}%</p>
        <p class="text-body-md text-slateink/80"><strong>Unanswered Rate:</strong> ${(dash.anomalies.unanswered_rate * 100).toFixed(1)}%</p>
      </div>
      <div class="p-4 bg-surface-glass rounded-xl shadow-sm">
        <h3 class="text-title-md text-slateink mb-2">Moderation</h3>
        <p class="text-body-md text-slateink/80"><strong>Total Moderated:</strong> ${dash.assessment.moderated}</p>
        <p class="text-body-md text-slateink/80"><strong>Blocked:</strong> ${dash.assessment.blocked}</p>
      </div>
      <div class="p-4 bg-surface-glass rounded-xl shadow-sm">
        <h3 class="text-title-md text-slateink mb-2">Results</h3>
        <p class="text-body-md text-slateink/80"><strong>Verified:</strong> ${dash.assessment.verified}</p>
        <p class="text-body-md text-slateink/80"><strong>Ready:</strong> ${dash.assessment.result_ready}</p>
      </div>
    </div>
    <div class="mt-6 flex justify-center">
      <button id="toggle-terrain" class="px-6 py-2 rounded-full bg-accent-blue text-ivory font-sans hover:bg-accent-blue/80 transition-colors shadow-md">
        Toggle 3D Anomaly Terrain
      </button>
    </div>
  `;

  container.appendChild(overlay);

  // Animate entry
  gsap.from(overlay, { opacity: 0, y: 20, duration: 0.6, ease: "power2.out" });

  let terrainVisible = false;
  document.getElementById('toggle-terrain')?.addEventListener('click', (e) => {
    terrainVisible = !terrainVisible;
    if (terrainVisible) {
      gsap.to(overlay.querySelector('.grid'), { opacity: 0, height: 0, duration: 0.3 });
      e.target.textContent = 'Hide Anomaly Terrain';
    } else {
      gsap.to(overlay.querySelector('.grid'), { opacity: 1, height: 'auto', duration: 0.3 });
      e.target.textContent = 'Toggle 3D Anomaly Terrain';
    }
  });
}
