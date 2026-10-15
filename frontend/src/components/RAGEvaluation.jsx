import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, AlertCircle, Loader } from 'lucide-react';

async function fetchJSON(url, options = {}) {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
        const body = await response.text();
        throw new Error(
            `Request failed (${response.status}) for ${url}: ${body.slice(0, 200)}`
        );
    }

    if (!contentType.includes('application/json')){
        const body = await response.text();
        throw new Error(
            `Expected JSON from ${url}, but received HTML or another content type. ` +
            `Response: ${body.slice(0, 200)}`
        );
    }
    return response.json();
}

export default function RAGEvaluation() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const data = await fetchJSON('/api/evaluate/history');

      if (data.success) {
        setHistory(data.history || []);
      } else {
        setError(data.error || 'Failed to fetch evaluation history');
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
      setError(err.message || 'Failed to fetch evaluation history');
    }
  };

  const runEvaluation = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJSON('/api/evaluate/run', {
        method: 'POST',
      });

      if (data.success) {
        await fetchHistory(); // Refresh history with the new result
      } else {
        setError(data.error || 'Evaluation failed');
      }
    } catch (err) {
        console.error('Failed to run evaluation:' , err);
        setError('Failed to run evaluation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 4.0) return '#10b981'; // Green
    if (score >= 3.0) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  const latestResult = history.length > 0 ? history[history.length - 1] : null;

  return (
    <div className="rag-eval-container">
      <div className="eval-header">
        <h2><Activity size={24} /> RAG Evaluation Dashboard</h2>
        <button 
          className="btn-primary" 
          onClick={runEvaluation}
          disabled={loading}
        >
          {loading ? <><Loader size={18} className="spinner" /> Running...</> : <><TrendingUp size={18} /> Run New Evaluation</>}
        </button>
      </div>

      {error && (
        <div className="alert-error"><AlertCircle size={20} /> {error}</div>
      )}

      {!latestResult && !loading && (
        <div className="empty-state">
          <p>No evaluations found. Click "Run New Evaluation" to start.</p>
        </div>
      )}

      {latestResult && (
        <>
          {/* Latest Results Cards */}
          <div className="eval-section">
            <h3>Latest Results ({new Date(latestResult.timestamp).toLocaleString()})</h3>
            <div className="metrics-grid">
              {Object.entries(latestResult.scores).map(([key, value]) => (
                <div key={key} className="metric-card">
                  <div className="metric-label">{key.replace(/_/g, ' ')}</div>
                  <div className="metric-value" style={{ color: getScoreColor(value) }}>
                    {value}/5
                  </div>
                  <div className="progress-bar-bg">
                    <div 
                      className="progress-bar-fill" 
                      style={{ width: `${(value / 5) * 100}%`, backgroundColor: getScoreColor(value) }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* History Table */}
          <div className="eval-section">
            <h3>Evaluation History</h3>
            <div className="history-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Overall Score</th>
                    <th>Faithfulness</th>
                    <th>Context Precision</th>
                    <th>Test Cases</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map((item, idx) => (
                    <tr key={idx}>
                      <td>{new Date(item.timestamp).toLocaleString()}</td>
                      <td style={{ color: getScoreColor(item.scores.overall_score), fontWeight: 'bold' }}>
                        {item.scores.overall_score}/5
                      </td>
                      <td>{item.scores.faithfulness}/5</td>
                      <td>{item.scores.context_precision}/5</td>
                      <td>{item.num_test_cases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}