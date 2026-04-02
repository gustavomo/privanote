const analyze = {
  startAnalysis: {
    id: 'v1.analyze.startAnalysis',
    method: 'POST',
    path: '/api/v1/analyze/pr',
  },
  getAnalysisStatus: {
    id: 'v1.analyze.getAnalysisStatus',
    method: 'GET',
    path: '/api/v1/analyze/pr/:jobId',
  },
};

module.exports = { analyze };
