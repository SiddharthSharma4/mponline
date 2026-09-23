export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const apiClient = {
  async uploadDocument(file, type, onProgress = () => {}) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', type);

    // Using fetch doesn't easily support upload progress without XMLHttpRequest,
    // but we can fake the upload progress before the fetch for the prototype feel
    // or implement XMLHttpRequest for real progress. We'll use fetch here.
    
    try {
      const response = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("API Upload Error:", error);
      throw error;
    }
  },

  async getDocumentStatus(jobId) {
    const response = await fetch(`${API_BASE_URL}/documents/status/${jobId}`);
    if (!response.ok) throw new Error(`Status lookup failed (${response.status})`);
    return response.json();
  },

  async getAssessments() {
    const response = await fetch(`${API_BASE_URL}/assessments/`);
    return response.json();
  },

  // Real, DB-backed assessment + question list for the golden path
  // (see backend/core/seed_data.py). Returns { status: 'READY', assessment, questions }
  // or an honest { status: 'UNAVAILABLE', reason } if nothing is provisioned yet.
  async getActiveAssessment() {
    const response = await fetch(`${API_BASE_URL}/assessments/active`);
    return response.json();
  },

  async categoriseAssessment(assessmentId) {
    const response = await fetch(`${API_BASE_URL}/categorise/${assessmentId}/categorise`, {
      method: 'POST'
    });
    return response.json();
  },

  // Real per-question mark entry, upserted against a real Evaluation row.
  async submitQuestionMark(assessmentId, questionId, score) {
    const response = await fetch(`${API_BASE_URL}/evaluation/session/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessment_id: assessmentId, question_id: questionId, score })
    });
    return response.json();
  },

  // Real examiner-entered ledger total, compared server-side against the
  // computed sum of persisted question marks during verification.
  async submitRecordedTotal(assessmentId, recordedTotal) {
    const response = await fetch(`${API_BASE_URL}/evaluation/session/recorded-total`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessment_id: assessmentId, recorded_total: recordedTotal })
    });
    return response.json();
  },

  // Restores the real in-progress evaluation (marks + recorded total) for an assessment.
  async getSessionEvaluation(assessmentId) {
    const response = await fetch(`${API_BASE_URL}/evaluation/session?assessment_id=${assessmentId}`);
    return response.json();
  },

  // Verification reads persisted marks server-side; no payload is sent or trusted.
  async verifyEvaluation(evaluationId) {
    const response = await fetch(`${API_BASE_URL}/verification/${evaluationId}/verify`, {
      method: 'POST'
    });
    return response.json();
  },

  async resolveModerationCase(caseId, decision) {
    const response = await fetch(`${API_BASE_URL}/moderation/${caseId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision })
    });
    return response.json();
  },

  // Result is computed server-side entirely from persisted marks; no payload is sent.
  async calculateResult(evaluationId) {
    const response = await fetch(`${API_BASE_URL}/results/${evaluationId}/calculate`, {
      method: 'POST'
    });
    return response.json();
  },

  async getAnalyticsDashboard() {
    const response = await fetch(`${API_BASE_URL}/analytics/dashboard`);
    return response.json();
  },

  async getEvaluation(evaluationId) {
    const response = await fetch(`${API_BASE_URL}/evaluation/${evaluationId}`);
    return response.json();
  }
};
