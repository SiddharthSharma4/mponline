import { gsap } from 'gsap';

export function renderModerationStage(container, state) {
  const signals = state.verificationResult?.signals || [];
  const hasCases = signals.length > 0;
  
  if (!hasCases) {
    container.innerHTML = `
      <div class="h-full flex items-center justify-center p-8 bg-[#FAF8F5]/30 pointer-events-auto">
        <div class="w-full max-w-3xl p-12 rounded-2xl shadow-sm flex flex-col items-center gap-6 bg-white/80 backdrop-blur-md border border-gray-200">
          <div class="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h2 class="text-2xl font-serif text-[#1E242B]">No Pending Cases</h2>
          <p class="text-slate-500 font-mono">The evaluation passed integrity checks automatically.</p>
          <button id="resolve-btn" class="mt-4 px-8 py-4 bg-[#1E242B] text-[#FAF8F5] rounded-lg shadow font-medium">Continue to Results</button>
        </div>
      </div>
    `;
    const btn = container.querySelector('#resolve-btn');
    if (btn) btn.addEventListener('click', () => window.setStage(8));
    return;
  }

  const primarySignal = signals[0];
  const evalId = state.mode === 'real'
    ? (window.EvalOS.state.realSession?.evaluationId || 'unknown')
    : (state.realSession?.documents?.answerScripts?.[0]?.id || "eval-000");

  container.innerHTML = `
    <div class="h-full flex items-center justify-center p-8 bg-[#FAF8F5]/30 pointer-events-auto">
      <div class="w-full max-w-3xl p-8 rounded-2xl shadow-xl flex flex-col gap-6 bg-white/80 backdrop-blur-md border border-gray-200" id="moderation-panel">
        
        <header class="border-b border-gray-200 pb-4">
          <h2 class="text-3xl font-serif text-[#1E242B]">Senior Moderator Workspace</h2>
          <p class="text-sm text-slate-500 font-mono mt-2">EVAL ID: ${evalId} &bull; URGENT RESOLUTION REQUIRED</p>
        </header>

        <div class="bg-red-50 border border-red-100 rounded-xl p-6" id="case-details">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center text-red-700 font-bold font-mono">!</div>
            <h3 class="text-xl font-semibold text-[#1E242B]">${primarySignal.type || 'Integrity Discrepancy Detected'}</h3>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-mono text-slate-700 mb-4">
            <div class="bg-white/60 p-3 rounded border border-red-100/50">
              <span class="text-slate-500 block text-xs uppercase tracking-wider mb-1">Trigger</span> 
              <span class="font-medium text-[#1E242B]">${primarySignal.question || 'System Check'}</span>
            </div>
            <div class="bg-white/60 p-3 rounded border border-red-100/50">
              <span class="text-slate-500 block text-xs uppercase tracking-wider mb-1">Evaluator</span> 
              <span class="font-medium text-[#1E242B]">Automated Verification</span>
            </div>
          </div>
          
          <div class="mt-2 text-[#1E242B] bg-white/80 p-4 rounded-lg border border-red-200 shadow-sm">
            <span class="font-bold text-red-800 uppercase text-xs tracking-wider block mb-1">Reason for Flag:</span> 
            <p class="font-serif text-lg">${primarySignal.message || primarySignal.detail || 'Discrepancy requires manual review.'}</p>
          </div>
        </div>

        <div id="resolution-area" class="flex flex-col items-center justify-center py-4">
          <button id="resolve-btn" class="px-8 py-4 bg-[#1E242B] text-[#FAF8F5] hover:opacity-90 rounded-lg shadow-lg transition-all font-medium flex items-center gap-3 text-lg">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Override & Resolve Case
          </button>
        </div>

        <div id="success-state" class="hidden bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <div class="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-inner">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h3 class="text-2xl font-serif text-[#1E242B] mb-3">Resolution Successful</h3>
          <p class="text-emerald-800 font-mono text-base bg-emerald-100/50 inline-block px-4 py-2 rounded">
            The discrepancy has been overridden by moderator approval.
          </p>
          <div class="mt-6 pt-6 border-t border-emerald-200/50 text-sm text-slate-500 font-mono">
            Cryptographic audit log updated. Awaiting next case...
          </div>
        </div>

      </div>
    </div>
  `;

  // Entrance Animations
  const panel = container.querySelector('#moderation-panel');
  const caseDetails = container.querySelector('#case-details');
  const resolveBtn = container.querySelector('#resolve-btn');
  const resolutionArea = container.querySelector('#resolution-area');
  const successState = container.querySelector('#success-state');

  gsap.fromTo(panel, 
    { opacity: 0, y: 40, scale: 0.95 },
    { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "power3.out" }
  );

  gsap.fromTo(caseDetails,
    { opacity: 0, x: -30 },
    { opacity: 1, x: 0, duration: 0.6, delay: 0.3, ease: "power2.out" }
  );

  gsap.fromTo(resolveBtn,
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.5, delay: 0.6, ease: "back.out(1.5)" }
  );

  // Interaction
  resolveBtn.addEventListener('click', async () => {
    // Disable button
    resolveBtn.disabled = true;
    resolveBtn.innerHTML = "Resolving...";

    const caseId = state.verificationResult?.case_id;
    if (!caseId) {
      console.error("No real moderation case id was returned by verification — cannot resolve.");
      resolveBtn.innerHTML = "No case to resolve";
      resolveBtn.disabled = true;
      return;
    }

    try {
      // Call Real API with the case id verification actually persisted
      const result = await window.EvalOS.apiClient.resolveModerationCase(caseId, "APPROVED");
      console.log("Moderation Result:", result);

      if (window.EvalOS.state.data.moderationCase) {
        window.EvalOS.state.data.moderationCase.status = 'RESOLVED';
      }
      
      // Animate resolution transition
      gsap.to(resolutionArea, {
        opacity: 0,
        height: 0,
        margin: 0,
        padding: 0,
        duration: 0.4,
        ease: "power2.inOut",
        onComplete: () => {
          resolutionArea.classList.add('hidden');
          successState.classList.remove('hidden');
          
          gsap.fromTo(successState,
            { opacity: 0, scale: 0.9, y: 20 },
            { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "back.out(1.2)" }
          );
          
          // Auto transition to Stage 8 (Result Ready)
          setTimeout(() => {
            window.setStage(8);
          }, 3000);
        }
      });

      gsap.to(caseDetails, {
        opacity: 0.6,
        filter: 'grayscale(100%)',
        duration: 0.5
      });
    } catch (err) {
      console.error("Moderation failed", err);
      resolveBtn.innerHTML = "Failed. Try Again.";
      resolveBtn.disabled = false;
    }
  });
}
