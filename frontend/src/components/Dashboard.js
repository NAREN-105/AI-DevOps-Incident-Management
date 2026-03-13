import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

function Dashboard() {
  const [incidents, setIncidents] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => { fetchIncidents(); }, []);

  const fetchIncidents = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/incidents/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIncidents(res.data);
    } catch (err) { console.log(err); }
  };

  const createIncident = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://127.0.0.1:5000/api/incidents/', 
        { title, description },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(`✅ Incident created! Severity: ${res.data.severity}`);
      setTitle(''); setDescription('');
      fetchIncidents();
    } catch (err) { setMessage('❌ Error creating incident!'); }
  };

  const updateStatus = async (id, status) => {
    await axios.put(`http://127.0.0.1:5000/api/incidents/${id}`,
      { status },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    fetchIncidents();
  };

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const severityColors = { Critical: '#e94560', High: '#ff6b35', Medium: '#ffd166', Low: '#06d6a0' };
  
  const pieData = ['Critical', 'High', 'Medium', 'Low'].map(s => ({
    name: s, value: incidents.filter(i => i.severity === s).length
  })).filter(d => d.value > 0);

  const barData = [
    { name: 'Open', count: incidents.filter(i => i.status === 'Open').length },
    { name: 'In Progress', count: incidents.filter(i => i.status === 'In Progress').length },
    { name: 'Resolved', count: incidents.filter(i => i.status === 'Resolved').length },
  ];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>🚨 AI DevOps Incident Management</h1>
        <button onClick={logout} style={styles.logoutBtn}>Logout</button>
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        {[
          { label: 'Total', value: incidents.length, color: '#4cc9f0' },
          { label: 'Open', value: incidents.filter(i => i.status === 'Open').length, color: '#e94560' },
          { label: 'Resolved', value: incidents.filter(i => i.status === 'Resolved').length, color: '#06d6a0' },
          { label: 'Critical', value: incidents.filter(i => i.severity === 'Critical').length, color: '#ff6b35' },
        ].map((stat, i) => (
          <div key={i} style={{...styles.statCard, borderTop: `4px solid ${stat.color}`}}>
            <h2 style={{color: stat.color, margin: 0}}>{stat.value}</h2>
            <p style={{color: '#aaa', margin: 0}}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={styles.chartsRow}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Severity Distribution</h3>
          <PieChart width={300} height={250}>
            <Pie data={pieData} cx={150} cy={110} outerRadius={80} dataKey="value">
              {pieData.map((entry, i) => (
                <Cell key={i} fill={severityColors[entry.name] || '#8884d8'} />
              ))}
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        </div>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Status Overview</h3>
          <BarChart width={300} height={250} data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="name" stroke="#aaa" />
            <YAxis stroke="#aaa" />
            <Tooltip />
            <Bar dataKey="count" fill="#4cc9f0" radius={[4,4,0,0]} />
          </BarChart>
        </div>
      </div>

      {/* Create Incident */}
      <div style={styles.formCard}>
        <h3 style={styles.chartTitle}>🤖 Create New Incident (AI Severity Prediction)</h3>
        {message && <p style={{color: '#06d6a0'}}>{message}</p>}
        <form onSubmit={createIncident} style={styles.form}>
          <input style={styles.input} placeholder="Incident Title" value={title}
            onChange={e => setTitle(e.target.value)} required />
          <textarea style={{...styles.input, height: '80px'}} placeholder="Description"
            value={description} onChange={e => setDescription(e.target.value)} required />
          <button style={styles.button} type="submit">🚀 Create & Predict Severity</button>
        </form>
      </div>

      {/* Incidents Table */}
      <div style={styles.tableCard}>
        <h3 style={styles.chartTitle}>📋 All Incidents</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              {['ID', 'Title', 'Description', 'Severity', 'Status', 'Action'].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {incidents.map(inc => (
              <tr key={inc.id} style={styles.tr}>
                <td style={styles.td}>{inc.id}</td>
                <td style={styles.td}>{inc.title}</td>
                <td style={styles.td}>{inc.description}</td>
                <td style={styles.td}>
                  <span style={{...styles.badge, background: severityColors[inc.severity]}}>
                    {inc.severity}
                  </span>
                </td>
                <td style={styles.td}>{inc.status}</td>
                <td style={styles.td}>
                  <select style={styles.select} value={inc.status}
                    onChange={e => updateStatus(inc.id, e.target.value)}>
                    <option>Open</option>
                    <option>In Progress</option>
                    <option>Resolved</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#0f0f1a', padding: '20px', fontFamily: 'Arial' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
  headerTitle: { color: '#e94560', margin: 0 },
  logoutBtn: { background: '#e94560', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' },
  statsRow: { display: 'flex', gap: '20px', marginBottom: '30px' },
  statCard: { background: '#1a1a2e', borderRadius: '12px', padding: '20px', flex: 1, textAlign: 'center' },
  chartsRow: { display: 'flex', gap: '20px', marginBottom: '30px' },
  chartCard: { background: '#1a1a2e', borderRadius: '12px', padding: '20px', flex: 1 },
  chartTitle: { color: '#4cc9f0', marginTop: 0 },
  formCard: { background: '#1a1a2e', borderRadius: '12px', padding: '20px', marginBottom: '30px' },
  form: { display: 'flex', flexDirection: 'column', gap: '10px' },
  input: { padding: '12px', borderRadius: '8px', border: '1px solid #333', background: '#0f0f1a', color: '#fff', fontSize: '1rem' },
  button: { padding: '12px', borderRadius: '8px', border: 'none', background: '#e94560', color: '#fff', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' },
  tableCard: { background: '#1a1a2e', borderRadius: '12px', padding: '20px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { color: '#4cc9f0', padding: '12px', textAlign: 'left', borderBottom: '1px solid #333' },
  td: { color: '#fff', padding: '12px', borderBottom: '1px solid #222' },
  tr: { '&:hover': { background: '#1e1e3a' } },
  badge: { padding: '4px 10px', borderRadius: '20px', color: '#fff', fontSize: '0.8rem', fontWeight: 'bold' },
  select: { background: '#0f0f1a', color: '#fff', border: '1px solid #333', padding: '6px', borderRadius: '6px' },
};

export default Dashboard;