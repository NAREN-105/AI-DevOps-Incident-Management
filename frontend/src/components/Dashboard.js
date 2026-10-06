import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000/api';
const STATUS_OPTIONS = ['Open', 'Assigned', 'In Progress', 'Resolved'];
const ROLE_OPTIONS = ['user', 'technician', 'manager'];

function dashboardData(token, role) {
  const headers = { Authorization: `Bearer ${token}` };
  const requests = [axios.get(`${API_BASE_URL}/incidents/`, { headers })];
  if (role === 'administrator' || role === 'manager') {
    requests.push(axios.get(`${API_BASE_URL}/auth/users`, { headers }));
  }
  return Promise.all(requests);
}

function Dashboard() {
  const [incidents, setIncidents] = useState([]);
  const [users, setUsers] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [pageError, setPageError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [activity, setActivity] = useState({ incidentId: null, events: [] });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username') || 'Account';
  const role = localStorage.getItem('role') || 'user';
  const isManager = role === 'administrator' || role === 'manager';
  const isAdministrator = role === 'administrator';
  const canReport = role !== 'technician';
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const pageTitle = {
    administrator: 'Operations control',
    manager: 'Team operations',
    technician: 'Assigned work queue',
    user: 'My incident reports',
  }[role] || 'My incident reports';

  const refreshDashboard = async () => {
    setPageError('');
    try {
      const result = await dashboardData(token, role);
      setIncidents(result[0].data);
      setUsers(result[1]?.data || []);
    } catch (err) {
      setPageError(err.response?.data?.error || 'Could not load the workspace. Check the API and database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshDashboard();
  // The session is fixed for this mounted dashboard; refresh is also available from the toolbar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createIncident = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      const response = await axios.post(`${API_BASE_URL}/incidents/`, { title, description }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(`Incident ${response.data.id} created. Severity: ${response.data.severity}. ${response.data.assigned_to ? `Assigned to ${response.data.assigned_to}.` : 'Waiting for a technician assignment.'}`);
      setTitle('');
      setDescription('');
      await refreshDashboard();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Incident creation failed.');
    }
  };

  const updateIncident = async (incidentId, change) => {
    setMessage('');
    try {
      await axios.patch(`${API_BASE_URL}/incidents/${incidentId}`, change, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage('Incident workflow updated. Notifications were queued for configured recipients.');
      await refreshDashboard();
      if (activity.incidentId === incidentId) await loadActivity(incidentId);
    } catch (err) {
      setPageError(err.response?.data?.error || 'Incident update failed.');
    }
  };

  const updateRole = async (userId, nextRole) => {
    try {
      await axios.patch(`${API_BASE_URL}/auth/users/${userId}/role`, { role: nextRole }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage('Account access updated. The user must sign in again to receive the new role.');
      await refreshDashboard();
    } catch (err) {
      setPageError(err.response?.data?.error || 'Account role update failed.');
    }
  };

  async function loadActivity(incidentId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/incidents/${incidentId}/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActivity({ incidentId, events: response.data });
    } catch (err) {
      setPageError(err.response?.data?.error || 'Could not load incident history.');
    }
  }

  const logout = () => {
    ['token', 'username', 'role', 'email', 'user_id'].forEach((key) => localStorage.removeItem(key));
    navigate('/login');
  };

  const filteredIncidents = incidents.filter((incident) => {
    const matchesSearch = `${incident.title} ${incident.description} ${incident.reporter_username || ''} ${incident.assigned_username || ''}`
      .toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === 'All statuses' || incident.status === statusFilter);
  });
  const openCount = incidents.filter((incident) => incident.status !== 'Resolved').length;
  const criticalCount = incidents.filter((incident) => incident.severity === 'Critical').length;

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <a className="dashboard-brand" href="/dashboard">
          <span className="dashboard-brand-mark">IR</span>
          <span>INCIDENT RESPONSE <small>OPERATIONS</small></span>
        </a>
        <div className="dashboard-session">
          <span className="session-identity"><strong>{username}</strong><small>{roleLabel}</small></span>
          <button className="quiet-button" type="button" onClick={refreshDashboard} title="Refresh workspace" aria-label="Refresh workspace">&#8635;</button>
          <button className="logout-button" type="button" onClick={logout}>Sign out</button>
        </div>
      </header>

      <div className="dashboard-main">
        <section className="workspace-heading">
          <div>
            <p className="workspace-kicker">{isManager ? 'TEAM RESPONSE / LIVE QUEUE' : role === 'technician' ? 'FIELD RESPONSE / ASSIGNED TO YOU' : 'SERVICE DESK / REQUEST TRACKING'}</p>
            <h1>{pageTitle}</h1>
            <p>{role === 'administrator'
              ? 'Triage incidents, route work, and manage team access.'
              : role === 'manager'
                ? 'Monitor team workload, coordinate assignments, and track resolution.'
                : role === 'technician'
                  ? 'Work through your assigned incidents and keep reporters informed.'
                  : 'Report a service problem and follow its progress to resolution.'}</p>
          </div>
          <span className="queue-indicator"><i /> WORKSPACE ACTIVE</span>
        </section>

        {pageError && <p className="workspace-alert workspace-alert-error" role="alert">{pageError}</p>}
        {message && <p className="workspace-alert" role="status">{message}</p>}

        <section className="metrics-row" aria-label="Incident summary">
          <div className="metric"><span>VISIBLE INCIDENTS</span><strong>{incidents.length}</strong></div>
          <div className="metric"><span>NEEDS ATTENTION</span><strong>{openCount}</strong></div>
          <div className="metric"><span>CRITICAL</span><strong className="metric-critical">{criticalCount}</strong></div>
          <div className="metric"><span>RESOLVED</span><strong>{incidents.length - openCount}</strong></div>
        </section>

        {canReport && (
          <section className="report-section">
            <div className="section-heading">
              <div><p className="workspace-kicker">NEW REQUEST</p><h2>Report an incident</h2></div>
              <span>Severity is estimated from the incident details.</span>
            </div>
            <form className="incident-form" onSubmit={createIncident}>
              <label>Short summary
                <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength="200" placeholder="For example: Build pipeline unavailable" required />
              </label>
              <label>What happened?
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength="10000" placeholder="Include impact, start time, and any steps already tried." required />
              </label>
              <button className="primary-button" type="submit">Submit incident <span aria-hidden="true">&#8594;</span></button>
            </form>
          </section>
        )}

        <section className="incident-section">
          <div className="section-heading incident-heading">
            <div><p className="workspace-kicker">{isManager ? 'ORGANIZATION QUEUE' : role === 'technician' ? 'YOUR ASSIGNMENTS' : 'YOUR REQUESTS'}</p><h2>{isManager ? 'Incident queue' : role === 'technician' ? 'Assigned to me' : 'Reported by me'}</h2></div>
            <div className="queue-filters">
              <input aria-label="Search incidents" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search incidents" />
              <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option>All statuses</option>
                {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
              </select>
            </div>
          </div>

          {isLoading ? <p className="empty-state">Loading incident queue...</p> : filteredIncidents.length === 0 ? (
            <p className="empty-state">No incidents match this view yet.</p>
          ) : (
            <div className="incident-table-wrap">
              <table className="incident-table">
                <thead><tr><th>Incident</th><th>Reporter</th><th>Priority</th><th>Status</th><th>Technician</th><th>Workflow</th></tr></thead>
                <tbody>
                  {filteredIncidents.map((incident) => {
                    const canUpdateStatus = isManager || (role === 'technician' && incident.assigned_user_id === Number(localStorage.getItem('user_id')));
                    const technicians = users.filter((user) => user.role === 'technician' && user.is_active);
                    return (
                      <React.Fragment key={incident.id}>
                        <tr>
                          <td className="incident-summary"><strong>#{incident.id} {incident.title}</strong><span>{incident.description}</span><small>{incident.created_at ? new Date(incident.created_at).toLocaleString() : ''}</small></td>
                          <td>{incident.reporter_username || 'Unknown'}<small>{incident.reporter_email || ''}</small></td>
                          <td><span className={`severity severity-${incident.severity.toLowerCase()}`}>{incident.severity}</span></td>
                          <td><span className={`status status-${incident.status.toLowerCase().replaceAll(' ', '-')}`}>{incident.status}</span></td>
                          <td>{incident.assigned_username || 'Unassigned'}</td>
                          <td className="workflow-cell">
                            {isManager && (
                              <select aria-label={`Assign incident ${incident.id}`} value={incident.assigned_user_id || ''} onChange={(event) => updateIncident(incident.id, { assigned_user_id: Number(event.target.value) })}>
                                <option value="" disabled>Select technician</option>
                                {technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.username}</option>)}
                              </select>
                            )}
                            {canUpdateStatus ? (
                              <select aria-label={`Update incident ${incident.id} status`} value={incident.status} onChange={(event) => updateIncident(incident.id, { status: event.target.value })}>
                                {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
                              </select>
                            ) : !isManager && role !== 'technician' ? <span className="read-only-label">Tracking</span> : null}
                            <button className="history-button" type="button" onClick={() => activity.incidentId === incident.id ? setActivity({ incidentId: null, events: [] }) : loadActivity(incident.id)}>
                              {activity.incidentId === incident.id ? 'Hide history' : 'History'}
                            </button>
                          </td>
                        </tr>
                        {activity.incidentId === incident.id && (
                          <tr className="activity-row"><td colSpan="6">
                            {activity.events.length ? activity.events.map((event, index) => (
                              <p key={`${event.created_at}-${index}`}><strong>{event.actor}</strong> {event.details}<time>{new Date(event.created_at).toLocaleString()}</time></p>
                            )) : <p>No activity recorded.</p>}
                          </td></tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {isManager && (
          <section className="accounts-section">
            <div className="section-heading"><div><p className="workspace-kicker">ACCESS CONTROL</p><h2>Team accounts</h2></div><span>{isAdministrator ? 'Promote users into technician or manager roles.' : 'Directory view. Administrators control role changes.'}</span></div>
            <div className="account-list">
              {users.map((user) => (
                <div className="account-row" key={user.id}>
                  <div><strong>{user.username}</strong><small>{user.email || 'No email on file'}</small></div>
                  {isAdministrator ? (
                    <select aria-label={`Role for ${user.username}`} value={user.role} onChange={(event) => updateRole(user.id, event.target.value)}>
                      {ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : <span className="account-role">{user.role}</span>}
                </div>
              ))}
              {users.length === 0 && <p className="empty-state">No registered accounts yet.</p>}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default Dashboard;