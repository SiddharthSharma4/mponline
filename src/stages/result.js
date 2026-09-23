import gsap from 'gsap';

export async function renderResultStage(container, state) {
  // Show loading state initially
  container.innerHTML = `
    <div class="h-full w-full flex items-center justify-center p-8 bg-[#FAF8F5] pointer-events-auto">
      <div class="text-slate-500 font-mono text-sm animate-pulse">CALCULATING FINAL RESULT...</div>
    </div>
  `;

  try {
    let evalId;
    if (state.mode === 'real') {
      evalId = window.EvalOS.state.realSession?.evaluationId;
    } else {
      evalId = state.realSession?.documents?.answerScripts?.[0]?.id || "eval-123";
    }

    if (!evalId) {
      renderResultCard(container, {
        questionsEvaluated: 'N/A',
        marksAwarded: 'N/A',
        integrityChecks: 'No evaluation recorded yet'
      }, 'UNAVAILABLE');
      return;
    }

    // Result is computed entirely server-side from persisted marks; nothing is
    // sent from the frontend that could influence the outcome.
    const resultData = await window.EvalOS.apiClient.calculateResult(evalId);

    if (resultData.status === 'BLOCKED' || resultData.status === 'UNAVAILABLE') {
      renderResultCard(container, {
        questionsEvaluated: 'Incomplete',
        marksAwarded: 'N/A',
        integrityChecks: resultData.reason || 'Result not available'
      }, resultData.status);
      return;
    }

    let summary = {
      questionsEvaluated: 'Complete',
      marksAwarded: `${resultData.total_marks}/${resultData.max_marks} (${resultData.percentage}%)`,
      integrityChecks: resultData.grade || 'Verified'
    };

    renderResultCard(container, summary, resultData.status);
  } catch (e) {
    console.error(e);
    renderResultCard(container, {
      questionsEvaluated: 'Error',
      marksAwarded: 'Error',
      integrityChecks: 'Failed'
    }, 'ERROR');
  }
}

function renderResultCard(container, summary, statusText = "READY") {
  const isGood = statusText === 'PUBLISHED';
  const badgeClasses = isGood ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200';
  const iconColor = isGood ? 'text-green-600' : 'text-amber-600';
  const topBar = isGood ? 'bg-green-500' : 'bg-amber-500';

  container.innerHTML = `
    <div class="h-full w-full flex items-center justify-center p-8 bg-[#FAF8F5] text-[#1E242B] font-['Plus_Jakarta_Sans'] pointer-events-auto">
      <div class="max-w-2xl w-full bg-white shadow-xl rounded-2xl overflow-hidden border border-[#E8E6E1] result-card opacity-0 translate-y-8">
        
        <!-- Header -->
        <div class="bg-[#1E242B] text-white p-8 text-center relative overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-1 ${topBar}"></div>
          <h2 class="text-3xl font-['Newsreader'] italic mb-2 relative z-10">Evaluation Complete</h2>
          <p class="text-white/70 font-['JetBrains_Mono'] text-sm tracking-wider relative z-10">STAGE 08 // RESULT READY</p>
          
          <!-- Decorative Background Elements -->
          <div class="absolute -right-16 -top-16 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
          <div class="absolute -left-16 -bottom-16 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
        </div>

        <!-- Content -->
        <div class="p-10">
          
          <div class="flex justify-center mb-10">
            <div class="inline-flex flex-col items-center justify-center badge-container opacity-0 scale-90">
              <span class="text-xs font-bold tracking-widest text-gray-500 mb-2 uppercase">Status</span>
              <div class="${badgeClasses} px-8 py-3 rounded-full border shadow-sm flex items-center space-x-3">
                <svg class="w-6 h-6 ${iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span class="text-2xl font-bold tracking-wider">${statusText}</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 summary-stats">
            <!-- Stat 1 -->
            <div class="bg-[#FAF8F5] p-5 rounded-xl border border-[#E8E6E1] text-center stat-item opacity-0 translate-y-4">
              <p class="text-xs text-gray-500 font-bold tracking-wider uppercase mb-1">Questions</p>
              <p class="text-2xl font-['JetBrains_Mono'] font-medium text-[#1E242B]">${summary.questionsEvaluated}</p>
            </div>
            
            <!-- Stat 2 -->
            <div class="bg-[#FAF8F5] p-5 rounded-xl border border-[#E8E6E1] text-center stat-item opacity-0 translate-y-4">
              <p class="text-xs text-gray-500 font-bold tracking-wider uppercase mb-1">Marks</p>
              <p class="text-2xl font-['JetBrains_Mono'] font-medium text-[#1E242B]">${summary.marksAwarded}</p>
            </div>
            
            <!-- Stat 3 -->
            <div class="bg-[#FAF8F5] p-5 rounded-xl border border-[#E8E6E1] text-center stat-item opacity-0 translate-y-4">
              <p class="text-xs text-gray-500 font-bold tracking-wider uppercase mb-1">Integrity</p>
              <p class="text-lg font-['JetBrains_Mono'] font-medium text-green-600 mt-1">${summary.integrityChecks}</p>
            </div>
          </div>

          <div class="flex justify-center actions opacity-0">
            <button class="bg-[#1E242B] text-white px-8 py-3 rounded-lg hover:bg-gray-800 transition-colors duration-300 font-medium tracking-wide shadow-lg shadow-gray-200 flex items-center space-x-2">
              <span>View Detailed Report</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
              </svg>
            </button>
          </div>
          
        </div>
      </div>
    </div>
  `;

  // Animations
  const tl = gsap.timeline({ delay: 0.1 });
  
  tl.to('.result-card', {
    y: 0,
    opacity: 1,
    duration: 0.8,
    ease: 'power3.out'
  })
  .to('.badge-container', {
    scale: 1,
    opacity: 1,
    duration: 0.6,
    ease: 'back.out(1.5)'
  }, '-=0.4')
  .to('.stat-item', {
    y: 0,
    opacity: 1,
    duration: 0.5,
    stagger: 0.1,
    ease: 'power2.out'
  }, '-=0.2')
  .to('.actions', {
    opacity: 1,
    duration: 0.5,
    ease: 'power2.out'
  }, '-=0.1');

  return () => {
    tl.kill();
    container.innerHTML = '';
  };
}
