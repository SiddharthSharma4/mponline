import gsap from 'gsap';

export async function renderCategoriseStage(container, state) {
  container.innerHTML = `
    <div class="h-full w-full flex items-center justify-center p-8 pointer-events-auto">
      <div class="text-slate-500 font-mono text-sm animate-pulse" id="cat-loading">RUNNING AI CATEGORISATION...</div>
    </div>
  `;

  let result;
  try {
    const evalId = state.realSession?.documents?.answerScripts?.[0]?.id || "eval-123";
    result = await window.EvalOS.apiClient.categoriseAssessment(evalId);
  } catch (err) {
    console.error(err);
    result = { category: "ERROR", message: "Failed to categorise", confidence: 0 };
  }

  // Persist so downstream stages (e.g. the examiner workspace) can show the
  // real categorisation instead of a fabricated placeholder.
  window.EvalOS.state.categorisationResult = result;

  container.innerHTML = '';

  const dashboard = document.createElement('div');
  dashboard.className = 'w-full max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[60vh] py-12 pointer-events-auto';

  const title = document.createElement('h2');
  title.className = 'text-3xl font-newsreader text-[#1E242B] mb-12 text-center font-semibold categorise-title';
  title.textContent = 'AI Categorisation Complete';

  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'flex flex-col items-center justify-center w-full mb-12';

  const card = document.createElement('div');
  let bgColor = 'bg-slate-50', borderColor = 'border-slate-200', textColor = 'text-slate-900', valueColor = 'text-slate-700';
  
  if (result.category.includes('HIGH')) {
    bgColor = 'bg-emerald-50'; borderColor = 'border-emerald-200'; textColor = 'text-emerald-900'; valueColor = 'text-emerald-700';
  } else if (result.category.includes('PARTIAL')) {
    bgColor = 'bg-amber-50'; borderColor = 'border-amber-200'; textColor = 'text-amber-900'; valueColor = 'text-amber-700';
  } else if (result.category.includes('LOW') || result.category.includes('REVIEW')) {
    bgColor = 'bg-rose-50'; borderColor = 'border-rose-200'; textColor = 'text-rose-900'; valueColor = 'text-rose-700';
  }

  card.className = `categorise-card flex flex-col items-center justify-center p-10 rounded-2xl border ${bgColor} ${borderColor} shadow-sm transition-transform hover:-translate-y-1 duration-300 cursor-default min-w-[300px]`;

  const titleEl = document.createElement('h3');
  titleEl.className = `text-lg font-jakarta font-medium mb-4 ${textColor} tracking-wide uppercase text-sm`;
  titleEl.textContent = 'Assigned Category';

  const valueEl = document.createElement('div');
  valueEl.className = `text-3xl font-jakarta font-bold mb-4 ${valueColor} text-center`;
  valueEl.textContent = result.category;

  const descEl = document.createElement('p');
  descEl.className = `text-sm text-center font-jakarta ${textColor} opacity-80 max-w-[250px] leading-relaxed`;
  descEl.textContent = `Confidence: ${(result.confidence * 100).toFixed(1)}% - ${result.message}`;

  card.appendChild(titleEl);
  card.appendChild(valueEl);
  card.appendChild(descEl);
  cardsContainer.appendChild(card);

  const messageContainer = document.createElement('div');
  messageContainer.className = 'text-center max-w-2xl mx-auto p-8 bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm category-message';
  
  const mainMessage = document.createElement('p');
  mainMessage.className = 'font-jakarta text-[#1E242B] text-xl font-medium mb-2';
  mainMessage.textContent = 'AI has prioritised the workload.';
  
  const subMessage = document.createElement('p');
  subMessage.className = 'font-jakarta text-slate-500 text-base';
  subMessage.textContent = '0 marks have been awarded. Awaiting human evaluation.';

  messageContainer.appendChild(mainMessage);
  messageContainer.appendChild(subMessage);

  dashboard.appendChild(title);
  dashboard.appendChild(cardsContainer);
  dashboard.appendChild(messageContainer);
  
  const actionContainer = document.createElement('div');
  actionContainer.className = 'mt-10 flex justify-center w-full category-action opacity-0 translate-y-4';
  const startBtn = document.createElement('button');
  startBtn.className = 'px-8 py-4 bg-slateink text-ivory rounded-full font-sans font-medium tracking-wide hover:bg-slateink/90 transition-all duration-300 shadow-lg flex items-center gap-2 group';
  startBtn.innerHTML = `
    Begin Evaluation
    <svg class="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
  `;
  startBtn.addEventListener('click', () => {
    window.setStage(4);
  });
  actionContainer.appendChild(startBtn);
  dashboard.appendChild(actionContainer);
  
  container.appendChild(dashboard);

  // Animate elements
  gsap.fromTo('.categorise-title', 
    { opacity: 0, y: -20 },
    { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }
  );

  gsap.fromTo('.categorise-card',
    { opacity: 0, y: 40, scale: 0.95 },
    { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'back.out(1.2)', delay: 0.2 }
  );

  gsap.fromTo('.category-message',
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.8 }
  );

  gsap.fromTo('.category-action',
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 1.0 }
  );
}
