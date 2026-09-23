import gsap from 'gsap';
import { processPDF } from '../utils/pdfProcessor.js';
import { watchMarkingSchemeParsing } from '../utils/schemeParsing.js';

export function renderUploadStage(container, state) {
  const meta = {
    institution: state.data?.institution?.name || "University Examination Council",
    title: state.data?.assessment?.title || "Final Term Examination",
    code: state.data?.assessment?.code || "CS-402",
    totalMarks: state.data?.assessment?.totalMarks || 100
  };

  // Ensure documents state is ready
  window.EvalOS = window.EvalOS || {};
  window.EvalOS.state = window.EvalOS.state || {};
  window.EvalOS.state.realSession = window.EvalOS.state.realSession || {};
  window.EvalOS.state.realSession.documents = {
    answerScripts: [],
    markingScheme: null,
    assessmentStructure: null
  };

  const uploadCategories = [
    { id: 'answerScripts', title: 'Answer Scripts (PDFs)', isArray: true },
    { id: 'markingScheme', title: 'Marking Scheme', isArray: false },
    { id: 'assessmentStructure', title: 'Assessment Structure', isArray: false }
  ];

  container.innerHTML = `
    <div class="min-h-screen w-full flex items-center justify-center p-6 bg-[#FAF8F5] text-[#1E242B] font-sans pointer-events-auto">
      <div class="glass-card upload-container max-w-3xl w-full bg-white/60 backdrop-blur-xl border border-[#1E242B]/10 rounded-3xl p-10 shadow-2xl flex flex-col gap-8 opacity-0 translate-y-8">
        
        <!-- Institution & Assessment Details -->
        <div class="header-section flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-[#1E242B]/10 pb-8">
          <div class="flex-1">
            <h2 class="text-sm uppercase tracking-widest text-[#1E242B]/60 font-semibold mb-2 font-mono">Institution Identity</h2>
            <h1 class="text-3xl md:text-4xl font-serif text-[#1E242B] leading-tight">${meta.institution}</h1>
          </div>
          <div class="text-left md:text-right">
            <div class="text-xl font-medium font-sans">${meta.title}</div>
            <div class="text-sm font-mono text-[#1E242B]/70 mt-1">CODE: ${meta.code} &nbsp;|&nbsp; MARKS: ${meta.totalMarks}</div>
          </div>
        </div>

        <!-- Upload Zones -->
        <div class="upload-zones grid grid-cols-1 md:grid-cols-3 gap-6">
          ${uploadCategories.map((cat, index) => `
            <div class="upload-item flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#1E242B]/20 rounded-2xl bg-white/40 hover:bg-white/80 transition-colors duration-300 group cursor-pointer relative overflow-hidden" data-id="${cat.id}">
              <input type="file" accept=".pdf" class="hidden file-input" />
              
              <div class="icon-container w-12 h-12 rounded-full bg-[#1E242B]/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg class="w-6 h-6 text-[#1E242B]/70 default-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                <div class="spinner w-5 h-5 border-2 border-[#1E242B]/30 border-t-[#1E242B] rounded-full animate-spin hidden"></div>
                <svg class="w-6 h-6 hidden success-icon text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
              
              <span class="text-sm font-medium text-center title-text">${cat.title}</span>
              
              <div class="details-text text-xs text-[#1E242B]/60 mt-2 text-center hidden flex-col items-center gap-1">
                <span class="file-name truncate w-full max-w-[150px] font-mono"></span>
                <span class="file-meta"></span>
              </div>
              
              <div class="progress-bar absolute bottom-0 left-0 h-1 bg-[#1E242B] w-0"></div>
            </div>
          `).join('')}
        </div>

        <!-- Action Button -->
        <div class="action-section flex justify-end mt-4">
          <button id="init-pipeline-btn" disabled class="px-8 py-4 bg-[#1E242B] text-[#FAF8F5] rounded-xl font-medium tracking-wide hover:bg-[#1E242B]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-3">
            <span class="btn-text">Initialize Assessment Pipeline</span>
            <svg class="w-5 h-5 hidden btn-success-icon text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            <div class="btn-spinner w-5 h-5 border-2 border-[#FAF8F5]/30 border-t-[#FAF8F5] rounded-full animate-spin hidden"></div>
          </button>
        </div>
      </div>
    </div>
  `;

  // GSAP Animations
  const tl = gsap.timeline();
  tl.to('.upload-container', { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' })
    .from('.header-section', { opacity: 0, y: -20, duration: 0.6, ease: 'power2.out' }, '-=0.4')
    .from('.upload-item', { opacity: 0, y: 20, duration: 0.5, stagger: 0.15, ease: 'back.out(1.2)' }, '-=0.2')
    .from('.action-section', { opacity: 0, duration: 0.5 }, '-=0.2');

  const uploadItems = container.querySelectorAll('.upload-item');
  const initBtn = container.querySelector('#init-pipeline-btn');
  const btnText = initBtn.querySelector('.btn-text');
  const btnSpinner = initBtn.querySelector('.btn-spinner');
  const btnSuccessIcon = initBtn.querySelector('.btn-success-icon');

  function checkAllUploaded() {
    const docs = window.EvalOS.state.realSession.documents;
    // Allow advancing if ANY document is present for testing the document engine
    const anyUploaded = docs.answerScripts.length > 0 || docs.markingScheme || docs.assessmentStructure;
    
    if (anyUploaded) {
      initBtn.disabled = false;
      gsap.to(initBtn, { scale: 1.05, duration: 0.2, yoyo: true, repeat: 1 });
    } else {
      initBtn.disabled = true;
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  uploadItems.forEach(item => {
    const fileInput = item.querySelector('.file-input');
    const catId = item.dataset.id;
    const isArray = uploadCategories.find(c => c.id === catId).isArray;

    item.addEventListener('click', (e) => {
      // Prevent clicking input itself from re-triggering this
      if (e.target !== fileInput) {
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const iconContainer = item.querySelector('.icon-container');
      const defaultIcon = item.querySelector('.default-icon');
      const spinner = item.querySelector('.spinner');
      const successIcon = item.querySelector('.success-icon');
      const detailsText = item.querySelector('.details-text');
      const fileNameEl = item.querySelector('.file-name');
      const fileMetaEl = item.querySelector('.file-meta');
      const progressBar = item.querySelector('.progress-bar');

      // Show loading state
      defaultIcon.classList.add('hidden');
      successIcon.classList.add('hidden');
      spinner.classList.remove('hidden');
      
      gsap.to(progressBar, { width: '50%', duration: 0.5 });

      // Setup diagnostics
      let diagPanel = document.getElementById('doc-diagnostics');
      if (!diagPanel) {
        diagPanel = document.createElement('div');
        diagPanel.id = 'doc-diagnostics';
        diagPanel.className = 'fixed bottom-4 left-4 bg-black/80 text-green-400 font-mono text-xs p-4 rounded-lg z-50 pointer-events-none whitespace-pre';
        diagPanel.innerHTML = 'DOCUMENT DIAGNOSTICSn';
        document.body.appendChild(diagPanel);
      }
      diagPanel.innerHTML = 'DOCUMENT DIAGNOSTICSn';

      const updateDiagnostics = (msg) => {
        diagPanel.innerHTML += msg + 'n';
      };

      try {
        updateDiagnostics('Uploading to backend API...');
        
        // 1. Upload to FastAPI Backend for persistence and Async ML/OCR
        const backendDoc = await window.EvalOS.apiClient.uploadDocument(file, catId, updateDiagnostics);
        updateDiagnostics(`Backend Upload Success (ID: ${backendDoc.id})`);

        // 2. Process locally for 3D Examiner Engine textures
        updateDiagnostics('Extracting 3D rendering textures locally...');
        const doc = await processPDF(file, updateDiagnostics);
        
        // Merge the backend ID into the local doc object
        doc.id = backendDoc.id;
        
        updateDiagnostics('Stored ✓');
        
        // Save to state
        if (isArray) {
          window.EvalOS.state.realSession.documents[catId].push(doc);
        } else {
          window.EvalOS.state.realSession.documents[catId] = doc;
        }

        // Update UI
        spinner.classList.add('hidden');
        successIcon.classList.remove('hidden');
        iconContainer.classList.add('bg-[#1E242B]', 'text-[#FAF8F5]');
        iconContainer.classList.remove('bg-[#1E242B]/5');
        
        fileNameEl.textContent = doc.name;
        fileMetaEl.textContent = `${formatBytes(doc.size)} • ${doc.pages} Pages`;
        detailsText.classList.remove('hidden');
        detailsText.classList.add('flex');
        
        gsap.to(progressBar, { width: '100%', duration: 0.5 });

        // Marking scheme: surface the backend's honest parse outcome under the file name.
        if (catId === 'markingScheme') {
          const parseLine = document.createElement('span');
          parseLine.className = 'scheme-parse-status text-[11px] font-mono text-center leading-snug';
          detailsText.appendChild(parseLine);
          const tones = { ok: 'text-emerald-700', unavailable: 'text-amber-700', pending: 'text-[#1E242B]/60' };
          watchMarkingSchemeParsing(backendDoc.id, ({ tone, text }) => {
            parseLine.textContent = text;
            parseLine.className = `scheme-parse-status text-[11px] font-mono text-center leading-snug ${tones[tone] || ''}`;
            updateDiagnostics(text);
          });
        }
        
        checkAllUploaded();
      } catch (error) {
        console.error("Error processing document:", error);
        updateDiagnostics(`ERROR: ${error.message || error}`);
        
        // Revert UI on error
        spinner.classList.add('hidden');
        defaultIcon.classList.remove('hidden');
        gsap.to(progressBar, { width: '0%', duration: 0.3 });
        
        // Detailed error message as requested
        alert(`PDF COULD NOT BE OPENEDnn${error.message || error}nnThe selected file appears to be corrupted or unsupported. Try another PDF.`);
      }
      
      // Reset input
      e.target.value = '';
    });
  });

  initBtn.addEventListener('click', () => {
    initBtn.disabled = true;
    btnText.textContent = 'Initializing...';
    btnSpinner.classList.remove('hidden');
    
    setTimeout(() => {
      btnSpinner.classList.add('hidden');
      btnSuccessIcon.classList.remove('hidden');
      btnText.textContent = 'Pipeline Ready';
      
      gsap.to('.upload-container', {
        scale: 0.95,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.in',
        delay: 0.5,
        onComplete: () => {
          // If in real mode and an answer script is available, map its pages to the 3D booklet
          if (state.mode === 'real' && state.realSession.documents.answerScripts?.[0]?.renderedCanvases) {
            if (window.EvalOS && window.EvalOS.sceneController && window.EvalOS.sceneController.booklet) {
              window.EvalOS.sceneController.booklet.updateTexturesFromRealSession(state.realSession.documents.answerScripts[0].renderedCanvases);
            }
          }
          
          if (typeof state.onComplete === 'function') {
            state.onComplete();
          } else {
            window.setStage(2);
          }
        }
      });
    }, 1000);
  });
}
