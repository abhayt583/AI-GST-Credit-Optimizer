import React, { useState, useEffect } from 'react';
import './App.css';

interface Client {
  id: string;
  name: string;
  gstin: string;
  business_type: string;
  annual_turnover: number;
}

interface Invoice {
  invoice_no: string;
  gstin: string;
  amount: number;
  gst_amount: number;
  itc_eligible: boolean;
  tax_type: string;
  state_code: string;
  anomaly?: boolean;
  optimization_suggestion?: string;
}

interface Insights {
  total_amount: number;
  total_gst: number;
  itc_eligible: number;
  total_invoices: number;
  anomalies_detected: number;
  insights: Array<{
    type: string;
    message: string;
  }>;
}

const INDUSTRY_TYPES = [
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'services', label: 'Services' },
  { value: 'trading', label: 'Trading' },
  { value: 'retail', label: 'Retail' }
];

function App() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    gstin: '',
    business_type: '',
    annual_turnover: 0
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/clients');
      if (!response.ok) throw new Error('Failed to fetch clients');
      const data = await response.json();
      setClients(data);
    } catch (err) {
      setError('Failed to fetch clients. Please try again.');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:5001/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error processing file');
      }

      const data = await response.json();
      setInvoices(data.invoices);
      setInsights(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5001/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newClient),
      });

      if (!response.ok) throw new Error('Failed to add client');

      await fetchClients();
      setShowAddClient(false);
      setNewClient({ name: '', gstin: '', business_type: '', annual_turnover: 0 });
    } catch (err) {
      setError('Failed to add client. Please try again.');
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>GST Credit Optimizer</h1>
        <p className="subtitle">AI-Powered GST Analysis & Optimization</p>
        <p className="description">
          Upload your GST invoices to get AI-powered insights, anomaly detection, and ITC optimization recommendations.
        </p>
      </header>

      <main className="app-main">
        <section className="client-section">
          <div className="section-header">
            <h2>Client Management</h2>
            <p className="section-description">
              Select an existing client or add a new one to manage their GST data.
            </p>
            <button 
              className="btn-primary"
              onClick={() => setShowAddClient(true)}
            >
              <span className="icon">+</span> Add New Client
            </button>
          </div>

          <div className="client-selector">
            <label htmlFor="client-select" className="select-label">Select Client</label>
            <select 
              id="client-select"
              value={selectedClient?.id || ''} 
              onChange={(e) => {
                const client = clients.find(c => c.id === e.target.value);
                setSelectedClient(client || null);
              }}
              className="select-input"
            >
              <option value="">Choose a client...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.gstin})
                </option>
              ))}
            </select>
          </div>
        </section>

        {showAddClient && (
          <div className="modal">
            <div className="modal-content">
              <h2>Add New Client</h2>
              <p className="modal-description">Fill in the details below to add a new client to the system.</p>
              
              <form onSubmit={handleClientSubmit} className="client-form">
                <div className="form-group">
                  <label htmlFor="name">Business Name</label>
                  <input
                    type="text"
                    id="name"
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    placeholder="Enter business name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="gstin">GSTIN</label>
                  <input
                    type="text"
                    id="gstin"
                    value={newClient.gstin}
                    onChange={(e) => setNewClient({ ...newClient, gstin: e.target.value })}
                    placeholder="Enter GSTIN number (e.g., 29ABCDE1234F1Z5)"
                    pattern="^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
                    title="Please enter a valid GSTIN number"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="business_type">Business Type</label>
                  <select
                    id="business_type"
                    value={newClient.business_type}
                    onChange={(e) => setNewClient({ ...newClient, business_type: e.target.value })}
                    required
                  >
                    <option value="">Select Industry Type</option>
                    {INDUSTRY_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="annual_turnover">Annual Turnover (₹)</label>
                  <div className="turnover-input">
                    <input
                      type="number"
                      id="annual_turnover"
                      value={newClient.annual_turnover || ''}
                      onChange={(e) => setNewClient({ ...newClient, annual_turnover: parseFloat(e.target.value) || 0 })}
                      placeholder="Enter annual turnover"
                      min="0"
                      step="1000"
                      required
                    />
                    <span className="turnover-hint">Enter amount in Indian Rupees</span>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    <i className="fas fa-plus"></i> Add Client
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddClient(false)}>
                    <i className="fas fa-times"></i> Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {insights && (
          <section className="results-section">
            <h3 className="section-title">Analysis Results</h3>
            <p className="results-description">
              Here's a summary of the analysis performed on your GST invoices.
            </p>
            <div className="insights-grid">
              <div className="insight-card">
                <h4>Total Amount</h4>
                <p className="insight-value">₹{insights.total_amount.toLocaleString()}</p>
                <p className="insight-description">Total invoice amount</p>
              </div>
              <div className="insight-card">
                <h4>Total GST</h4>
                <p className="insight-value">₹{insights.total_gst.toLocaleString()}</p>
                <p className="insight-description">Total GST amount</p>
              </div>
              <div className="insight-card">
                <h4>ITC Eligible</h4>
                <p className="insight-value">₹{insights.itc_eligible.toLocaleString()}</p>
                <p className="insight-description">Eligible for input tax credit</p>
              </div>
              <div className="insight-card">
                <h4>Total Invoices</h4>
                <p className="insight-value">{insights.total_invoices}</p>
                <p className="insight-description">Number of invoices processed</p>
              </div>
              <div className="insight-card">
                <h4>Anomalies Detected</h4>
                <p className="insight-value">{insights.anomalies_detected}</p>
                <p className="insight-description">Potential issues identified</p>
              </div>
            </div>
            <div className="insights-list">
              <h4>Key Insights</h4>
              {insights.insights.map((insight, index) => (
                <div key={index} className="insight-item">
                  <h5>{insight.type}</h5>
                  <p>{insight.message}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="upload-section">
          <div className="upload-area">
            <h3 className="section-title">Upload GST Invoices</h3>
            <p className="upload-description">
              Upload your CSV file containing GST invoice data. The file should include the following columns:
              invoice_no, gstin, amount, gst_amount, itc_eligible, tax_type, and state_code.
            </p>
            <div className="upload-box">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="file-input"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="upload-button">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                Choose File
              </label>
              {loading && (
                <div className="loading-container">
                  <div className="loading-spinner" />
                  <p>Processing your file...</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="error-message">
            <svg xmlns="http://www.w3.org/2000/svg" className="error-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

export default App; 