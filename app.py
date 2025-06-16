from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import os
import logging
from datetime import datetime
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import json

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(
    filename='gst_optimizer.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# In-memory storage for clients (replace with database in production)
clients = []

def detect_anomalies(df):
    """Detect anomalous GST amounts using Isolation Forest"""
    try:
        # Prepare features for anomaly detection
        features = df[['amount', 'gst_amount']].values
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features)
        
        # Train isolation forest
        iso_forest = IsolationForest(contamination=0.1, random_state=42)
        predictions = iso_forest.fit_predict(features_scaled)
        
        # Mark anomalies
        df['is_anomaly'] = predictions == -1
        return df
    except Exception as e:
        logging.error(f"Error in anomaly detection: {str(e)}")
        return df

def optimize_itc(df):
    """Optimize ITC eligibility based on business rules and patterns"""
    try:
        # Business rules for ITC optimization
        df['itc_optimization'] = 'No Change'
        
        # Rule 1: High-value transactions with eligible GSTIN
        high_value_mask = (df['amount'] > 100000) & (df['itc_eligible'] == 'No')
        df.loc[high_value_mask, 'itc_optimization'] = 'Consider ITC Claim'
        
        # Rule 2: Regular suppliers with consistent tax types
        supplier_tax_types = df.groupby('gstin')['tax_type'].nunique()
        consistent_suppliers = supplier_tax_types[supplier_tax_types == 1].index
        df.loc[df['gstin'].isin(consistent_suppliers) & (df['itc_eligible'] == 'No'), 
               'itc_optimization'] = 'Review ITC Eligibility'
        
        return df
    except Exception as e:
        logging.error(f"Error in ITC optimization: {str(e)}")
        return df

def generate_insights(df):
    """Generate business insights from the data"""
    insights = []
    
    try:
        # Calculate key metrics
        total_amount = df['amount'].sum()
        total_gst = df['gst_amount'].sum()
        itc_eligible = df[df['itc_eligible'] == 'Yes']['gst_amount'].sum()
        
        # Insight 1: ITC Utilization
        itc_utilization = (itc_eligible / total_gst) * 100
        insights.append({
            'type': 'ITC Utilization',
            'message': f'Current ITC utilization is {itc_utilization:.1f}%. '
                      f'Consider reviewing ineligible ITC claims.'
        })
        
        # Insight 2: Tax Type Distribution
        tax_distribution = df['tax_type'].value_counts(normalize=True) * 100
        insights.append({
            'type': 'Tax Type Analysis',
            'message': f'Tax type distribution: {", ".join([f"{k}: {v:.1f}%" for k, v in tax_distribution.items()])}'
        })
        
        # Insight 3: State-wise Analysis
        state_analysis = df.groupby('state_code').agg({
            'amount': 'sum',
            'gst_amount': 'sum'
        }).sort_values('amount', ascending=False)
        
        top_state = state_analysis.index[0]
        insights.append({
            'type': 'Geographic Analysis',
            'message': f'Highest transaction volume in state {top_state} with '
                      f'₹{state_analysis.loc[top_state, "amount"]:,.2f} in transactions'
        })
        
        return insights
    except Exception as e:
        logging.error(f"Error generating insights: {str(e)}")
        return []

# Helper function to convert numpy types to Python types
def to_python_type(val):
    if isinstance(val, (np.integer, np.int64, np.int32)):
        return int(val)
    if isinstance(val, (np.floating, np.float64, np.float32)):
        return float(val)
    if isinstance(val, np.bool_):
        return bool(val)
    if isinstance(val, np.ndarray):
        return val.tolist()
    return val

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'Only CSV files are allowed'}), 400

    try:
        # Read the CSV file
        df = pd.read_csv(file)
        
        # Validate required columns
        required_columns = ['invoice_no', 'gstin', 'amount', 'gst_amount', 'itc_eligible', 'tax_type', 'state_code']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return jsonify({'error': f'Missing required columns: {", ".join(missing_columns)}'}), 400

        # Apply AI-powered analysis
        df = detect_anomalies(df)
        df = optimize_itc(df)
        insights = generate_insights(df)
        
        # Convert DataFrame to list of dictionaries with Python types
        invoices = []
        for _, row in df.iterrows():
            invoice = {k: to_python_type(v) for k, v in row.items()}
            invoices.append(invoice)
        
        # Calculate summary with Python types
        total_amount = to_python_type(df['amount'].sum())
        total_gst = to_python_type(df['gst_amount'].sum())
        itc_eligible = to_python_type(df[df['itc_eligible'] == 'Yes']['gst_amount'].sum())
        
        summary = {
            'total_amount': total_amount,
            'total_gst': total_gst,
            'itc_eligible': itc_eligible,
            'total_invoices': len(invoices),
            'anomalies_detected': int(df['is_anomaly'].sum()),
            'insights': insights
        }

        return jsonify({
            'invoices': invoices,
            'summary': summary
        })

    except Exception as e:
        logging.error(f"Error processing file: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/clients', methods=['GET'])
def get_clients():
    return jsonify(clients)

@app.route('/api/clients', methods=['POST'])
def create_client():
    try:
        data = request.json
        required_fields = ['name', 'gstin', 'business_type', 'annual_turnover']
        
        # Validate required fields
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return jsonify({'error': f'Missing required fields: {", ".join(missing_fields)}'}), 400
        
        # Create new client
        new_client = {
            'id': str(len(clients) + 1),  # Simple ID generation
            'name': data['name'],
            'gstin': data['gstin'],
            'business_type': data['business_type'],
            'annual_turnover': float(data['annual_turnover']),
            'created_at': datetime.now().isoformat()
        }
        
        clients.append(new_client)
        return jsonify(new_client), 201
        
    except Exception as e:
        logging.error(f"Error creating client: {str(e)}")
        return jsonify({'error': 'Error creating client'}), 500

if __name__ == '__main__':
    try:
        print("Starting GST Credit Optimizer Backend Server...")
        print("Server will be available at: http://localhost:5001")
        print("Press CTRL+C to stop the server")
        app.run(debug=True, port=5001, host='0.0.0.0')
    except Exception as e:
        print(f"Error starting server: {str(e)}")
        print("Please make sure no other application is using port 5001") 