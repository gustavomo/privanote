const PR_SERVICE_BASE_URL = `http://127.0.0.1:${process.env.QODO_SERVICE_PORT || 8100}`;

async function startAnalysis(payload) {
  const response = await fetch(`${PR_SERVICE_BASE_URL}/api/v1/analyze/pr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `PR analysis service error: ${response.status}`);
  }
  return response.json();
}

async function getAnalysisStatus(jobId) {
  const response = await fetch(`${PR_SERVICE_BASE_URL}/api/v1/analyze/pr/${jobId}`);
  if (!response.ok) {
    if (response.status === 404) throw new Error('Job not found');
    throw new Error(`PR analysis service error: ${response.status}`);
  }
  return response.json();
}

async function checkPrServiceHealth() {
  try {
    const response = await fetch(`${PR_SERVICE_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

module.exports = { startAnalysis, getAnalysisStatus, checkPrServiceHealth };
