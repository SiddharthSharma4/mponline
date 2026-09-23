import gsap from 'gsap';

export async function renderExaminerStage(container, state) {
  container.innerHTML = `
    <div class="h-full w-full flex items-center justify-center p-8 pointer-events-auto">
      <div class="text-slate-500 font-mono text-sm animate-pulse" id="ex-loading">LOADING EVALUATION DATA...</div>
    </div>
  `;

  if (state.mode === 'real') {
    await renderRealExaminer(container, state);
  } else {
    await renderDemoExaminer(container, state);
  }
}

// ---------------------------------------------------------------------------
// REAL MODE: dynamic questions loaded from the database (see
// backend/api/v1/endpoints/assessments.py::get_active_assessment and
// backend/core/seed_data.py for how the real assessment gets provisioned).
// Nothing here is hardcoded to Q04/Q06 -- every question, its max marks, and
// its saved score come from the API.
// ---------------------------------------------------------------------------
async function renderRealExaminer(container, state) {
  const active = await window.EvalOS.apiClient.getActiveAssessment();

  if (active.status !== 'READY') {
    container.innerHTML = `
      <div class="h-full w-full flex items-center justify-center p-8 pointer-events-auto">
        <div class="max-w-md text-center bg-ivory/90 border border-ink/10 rounded-lg p-8 shadow-sm">
          <h2 class="text-sm uppercase tracking-widest text-coral font-mono mb-3">Assessment Not Available</h2>
          <p class="text-ink/70 text-sm leading-relaxed">${active.reason || 'MARKING SCHEME PROCESSING'}</p>
        </div>
      </div>
    `;
    return;
  }

  const { assessment, questions } = active;
  window.EvalOS.state.realSession = window.EvalOS.state.realSession || {};
  window.EvalOS.state.realSession.currentAssessment = assessment;

  let session = { marks: {}, recorded_total: null, evaluation_id: null };
  try {
    session = await window.EvalOS.apiClient.getSessionEvaluation(assessment.id);
  } catch (err) {
    console.warn('Could not restore session evaluation, starting fresh', err);
  }
  window.EvalOS.state.realSession.evaluationId = session.evaluation_id;

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'w-full h-full flex pointer-events-none relative z-10';

  const leftArea = document.createElement('div');
  leftArea.className = 'flex-grow h-full';

  const rightPanel = document.createElement('div');
  rightPanel.className = 'w-[35%] h-full glass-panel border-l border-ink/10 flex flex-col pointer-events-auto p-6 overflow-y-auto bg-ivory/90 backdrop-blur-md text-ink font-sans';

  const header = document.createElement('div');
  header.className = 'mb-6 pb-4 border-b border-ink/10 flex justify-between items-end';
  header.innerHTML = `
    <div>
      <h2 class="text-xs uppercase tracking-widest text-ink/60 font-mono mb-1">Current Assessment</h2>
      <h1 class="text-2xl font-serif text-ink font-medium">${assessment.title}</h1>
    </div>
    <div class="text-right">
      <span class="text-xs font-mono text-ink/60 bg-ink/5 px-2 py-1 rounded">${assessment.code || ''}</span>
    </div>
  `;

  const aiContext = document.createElement('div');
  aiContext.className = 'mb-6 bg-ink/5 rounded-lg p-5 border border-ink/10 shadow-sm';

  const cat = window.EvalOS.state.categorisationResult;
  const categoryLabel = cat
    ? `${cat.category}${cat.confidence ? ` (${(cat.confidence * 100).toFixed(1)}%)` : ''}`
    : 'NOT AVAILABLE';

  let candidateAnswer = 'Extracted text not available for this preview.';
  const docId = state.realSession?.documents?.answerScripts?.[0]?.id;
  if (docId) {
    try {
      const resp = await fetch(`${window.EvalOS.API_BASE_URL}/documents/status/${docId}`);
      if (resp.ok) {
        const statusData = await resp.json();
        const pageText = statusData?.result_data?.documentIntelligence?.pages?.[0]?.text;
        if (pageText && pageText.trim()) candidateAnswer = pageText.trim().slice(0, 500);
      }
    } catch (e) {
      console.warn('Could not fetch real OCR text', e);
    }
  }

  aiContext.innerHTML = `
    <h3 class="text-sm font-semibold mb-3 flex items-center gap-2 uppercase tracking-wide">
      <svg class="w-4 h-4 text-ink/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      Evidence Tether Trace
    </h3>
    <div class="space-y-3">
      <div class="flex justify-between items-center text-sm">
        <span class="text-ink/70">AI Categorisation:</span>
        <span class="font-mono font-medium text-ink bg-white/60 px-2 py-0.5 rounded shadow-sm border border-ink/5">${categoryLabel}</span>
      </div>
      <div class="text-sm border-t border-ink/10 pt-3 mt-3">
        <p class="text-ink/80 leading-relaxed font-serif italic">"${candidateAnswer}"</p>
      </div>
    </div>
  `;

  const rubricSection = document.createElement('div');
  rubricSection.className = 'flex-grow mb-6 flex flex-col gap-3';

  const computedTotal = () => Object.values(session.marks).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  const maxTotal = questions.reduce((a, q) => a + q.max_marks, 0);

  let rubricHTML = `
    <div class="flex justify-between items-center mb-1">
      <h3 class="text-sm font-semibold uppercase tracking-wider text-ink/60 font-mono">Marking Rubric</h3>
      <span class="text-xs font-mono font-bold bg-ink text-ivory px-2 py-1 rounded shadow-sm">Total: <span id="q-total-mark">${computedTotal()}</span> / ${maxTotal}</span>
    </div>
    <div class="space-y-3">
  `;

  questions.forEach(q => {
    const existing = session.marks[q.id];
    rubricHTML += `
      <div class="rubric-step group bg-white border border-ink/10 rounded-lg p-4 transition-all hover:border-ink/30 hover:shadow-sm" data-question-block="${q.id}">
        <div class="flex justify-between items-start gap-4 mb-3">
          <p class="text-sm font-medium text-ink/90">${q.label} &mdash; ${q.text}</p>
          <span class="text-xs font-mono text-ink/50 whitespace-nowrap">Max: ${q.max_marks}</span>
        </div>
        <div class="flex gap-2 flex-wrap">
          ${Array.from({length: q.max_marks + 1}, (_, i) => `
            <button class="mark-btn w-8 h-8 rounded-full border border-ink/20 text-sm font-mono text-ink/70 hover:bg-ink/5 hover:text-ink transition-colors focus:outline-none flex items-center justify-center ${existing === i ? 'bg-ink text-ivory border-ink' : ''}" data-question="${q.id}" data-mark="${i}" ${existing === i ? 'data-selected="true"' : ''}>
              ${i}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  });

  rubricHTML += `</div>`;

  rubricHTML += `
    <div class="mt-2 bg-white border border-ink/10 rounded-lg p-4">
      <label class="text-xs font-mono uppercase tracking-wide text-ink/60 block mb-2">Recorded Total (as written on script)</label>
      <input id="recorded-total-input" type="number" min="0" class="w-full border border-ink/20 rounded px-3 py-2 text-sm font-mono" value="${session.recorded_total ?? ''}" placeholder="e.g. ${maxTotal}">
    </div>
  `;
  rubricSection.innerHTML = rubricHTML;

  const actionSection = document.createElement('div');
  actionSection.className = 'mt-auto pt-6 border-t border-ink/10';
  const submitBtn = document.createElement('button');
  submitBtn.className = 'w-full bg-ink text-ivory py-4 px-6 rounded text-sm font-medium tracking-wide hover:bg-ink/90 transition-colors shadow-sm flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed';
  const allMarked = () => questions.every(q => session.marks[q.id] !== undefined);
  submitBtn.disabled = !allMarked();
  submitBtn.innerHTML = `Submit Checked Copy <svg class="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>`;
  actionSection.appendChild(submitBtn);

  rightPanel.appendChild(header);
  rightPanel.appendChild(aiContext);
  rightPanel.appendChild(rubricSection);
  rightPanel.appendChild(actionSection);
  wrapper.appendChild(leftArea);
  wrapper.appendChild(rightPanel);
  container.appendChild(wrapper);

  const totalMarkEl = rightPanel.querySelector('#q-total-mark');

  rightPanel.querySelectorAll('.mark-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const questionId = e.currentTarget.dataset.question;
      const markVal = parseInt(e.currentTarget.dataset.mark);

      rightPanel.querySelectorAll(`.mark-btn[data-question="${questionId}"]`).forEach(b => {
        b.removeAttribute('data-selected');
        b.classList.remove('bg-ink', 'text-ivory', 'border-ink');
      });
      e.currentTarget.setAttribute('data-selected', 'true');
      e.currentTarget.classList.add('bg-ink', 'text-ivory', 'border-ink');

      try {
        const result = await window.EvalOS.apiClient.submitQuestionMark(assessment.id, questionId, markVal);
        session.marks = result.marks;
        session.recorded_total = result.recorded_total;
        window.EvalOS.state.realSession.evaluationId = result.evaluation_id;
      } catch (err) {
        console.error('Failed to persist mark', err);
        session.marks[questionId] = markVal;
      }

      totalMarkEl.textContent = computedTotal();
      submitBtn.disabled = !allMarked();
    });
  });

  const recordedTotalInput = rightPanel.querySelector('#recorded-total-input');
  recordedTotalInput.addEventListener('change', async () => {
    const val = parseInt(recordedTotalInput.value);
    if (isNaN(val)) return;
    try {
      const result = await window.EvalOS.apiClient.submitRecordedTotal(assessment.id, val);
      session.recorded_total = result.recorded_total;
      window.EvalOS.state.realSession.evaluationId = result.evaluation_id;
    } catch (err) {
      console.error('Failed to persist recorded total', err);
    }
  });

  submitBtn.addEventListener('click', () => {
    window.setStage(5);
  });

  gsap.fromTo(rightPanel, { x: '100%', opacity: 0 }, { x: '0%', opacity: 1, duration: 0.8, ease: 'power3.out' });
  gsap.fromTo(header, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.3, ease: 'power2.out' });
  gsap.fromTo(aiContext, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.4, ease: 'power2.out' });
  gsap.fromTo(rightPanel.querySelectorAll('.rubric-step'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, delay: 0.5, ease: 'power2.out' });
  gsap.fromTo(actionSection, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.8, ease: 'power2.out' });
}

// ---------------------------------------------------------------------------
// DEMO MODE: unchanged scripted Q04 walkthrough for the guided demo tour.
// ---------------------------------------------------------------------------
async function renderDemoExaminer(container, state) {
  const existingMarks = window.EvalOS.state.data.marks?.Q04 || 0;

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'w-full h-full flex pointer-events-none relative z-10';

  const leftArea = document.createElement('div');
  leftArea.className = 'flex-grow h-full';

  const rightPanel = document.createElement('div');
  rightPanel.className = 'w-[35%] h-full glass-panel border-l border-ink/10 flex flex-col pointer-events-auto p-6 overflow-y-auto bg-ivory/90 backdrop-blur-md text-ink font-sans';

  const header = document.createElement('div');
  header.className = 'mb-6 pb-4 border-b border-ink/10 flex justify-between items-end';
  header.innerHTML = `
    <div>
      <h2 class="text-xs uppercase tracking-widest text-ink/60 font-mono mb-1">Current Task</h2>
      <h1 class="text-3xl font-serif text-ink font-medium">Question 04</h1>
    </div>
    <div class="text-right">
      <span class="text-xs font-mono text-ink/60 bg-ink/5 px-2 py-1 rounded">Subject: Physics</span>
    </div>
  `;

  const aiContext = document.createElement('div');
  aiContext.className = 'mb-8 bg-ink/5 rounded-lg p-5 border border-ink/10 shadow-sm';
  const candidateAnswer = state?.data?.evidenceTether?.candidateAnswer || 'Extracted candidate answer not available.';
  aiContext.innerHTML = `
    <h3 class="text-sm font-semibold mb-3 flex items-center gap-2 uppercase tracking-wide">
      <svg class="w-4 h-4 text-ink/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      Evidence Tether Trace
    </h3>
    <div class="space-y-3">
      <div class="flex justify-between items-center text-sm">
        <span class="text-ink/70">AI Categorisation:</span>
        <span class="font-mono font-medium text-ink bg-white/60 px-2 py-0.5 rounded shadow-sm border border-ink/5">High Match (99.4%)</span>
      </div>
      <div class="text-sm border-t border-ink/10 pt-3 mt-3">
        <p class="text-ink/80 leading-relaxed font-serif italic">"${candidateAnswer}"</p>
      </div>
    </div>
  `;

  const rubricSection = document.createElement('div');
  rubricSection.className = 'flex-grow mb-6 flex flex-col gap-4';

  const questionId = 4;
  const questionData = state.data.markingScheme.questions[questionId];
  const steps = questionData.steps;

  let rubricHTML = `
    <div class="flex justify-between items-center mb-1">
      <h3 class="text-sm font-semibold uppercase tracking-wider text-ink/60 font-mono">Marking Rubric</h3>
      <span class="text-xs font-mono font-bold bg-ink text-ivory px-2 py-1 rounded shadow-sm">Total: <span id="q-total-mark">${existingMarks}</span> / ${questionData.maxMarks}</span>
    </div>
    <div class="space-y-4">
  `;

  steps.forEach(step => {
    rubricHTML += `
      <div class="rubric-step group bg-white border border-ink/10 rounded-lg p-4 transition-all hover:border-ink/30 hover:shadow-sm">
        <div class="flex justify-between items-start gap-4 mb-3">
          <p class="text-sm font-medium text-ink/90">${step.description}</p>
          <span class="text-xs font-mono text-ink/50 whitespace-nowrap">Max: ${step.marks}</span>
        </div>
        <div class="flex gap-2">
          ${Array.from({length: step.marks + 1}, (_, i) => `
            <button class="mark-btn w-8 h-8 rounded-full border border-ink/20 text-sm font-mono text-ink/70 hover:bg-ink/5 hover:text-ink transition-colors focus:outline-none flex items-center justify-center data-[selected=true]:bg-ink data-[selected=true]:text-ivory data-[selected=true]:border-ink" data-step="${step.id}" data-mark="${i}">
              ${i}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  });

  rubricHTML += `</div>`;
  rubricSection.innerHTML = rubricHTML;

  const actionSection = document.createElement('div');
  actionSection.className = 'mt-auto pt-6 border-t border-ink/10';
  const submitBtn = document.createElement('button');
  submitBtn.className = 'w-full bg-ink text-ivory py-4 px-6 rounded text-sm font-medium tracking-wide hover:bg-ink/90 transition-colors shadow-sm flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed';
  submitBtn.disabled = true;
  submitBtn.innerHTML = `Submit Checked Copy <svg class="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>`;
  actionSection.appendChild(submitBtn);

  rightPanel.appendChild(header);
  rightPanel.appendChild(aiContext);
  rightPanel.appendChild(rubricSection);
  rightPanel.appendChild(actionSection);
  wrapper.appendChild(leftArea);
  wrapper.appendChild(rightPanel);
  container.appendChild(wrapper);

  const stepMarks = {};
  let totalMark = existingMarks;
  const totalMarkEl = rightPanel.querySelector('#q-total-mark');

  rightPanel.querySelectorAll('.mark-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const stepId = e.currentTarget.dataset.step;
      const markVal = parseInt(e.currentTarget.dataset.mark);

      rightPanel.querySelectorAll(`.mark-btn[data-step="${stepId}"]`).forEach(b => {
        b.removeAttribute('data-selected');
        b.classList.remove('bg-ink', 'text-ivory', 'border-ink');
      });
      e.currentTarget.setAttribute('data-selected', 'true');
      e.currentTarget.classList.add('bg-ink', 'text-ivory', 'border-ink');

      stepMarks[stepId] = markVal;
      totalMark = Object.values(stepMarks).reduce((a, b) => a + b, 0);
      totalMarkEl.textContent = totalMark;

      if (Object.keys(stepMarks).length === steps.length) {
        submitBtn.disabled = false;
      }
    });
  });

  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Submitting...';
    window.EvalOS.updateMark(4, totalMark);
    window.setStage(5);
  });

  gsap.fromTo(rightPanel, { x: '100%', opacity: 0 }, { x: '0%', opacity: 1, duration: 0.8, ease: 'power3.out' });
  gsap.fromTo(header, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.3, ease: 'power2.out' });
  gsap.fromTo(aiContext, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.4, ease: 'power2.out' });
  gsap.fromTo(rightPanel.querySelectorAll('.rubric-step'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, delay: 0.5, ease: 'power2.out' });
  gsap.fromTo(actionSection, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.8, ease: 'power2.out' });
}
