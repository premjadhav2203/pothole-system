import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import './App.css';

const SEVERITY = {
  High: { color: '#C0392B', label: 'High' },
  Medium: { color: '#D98E04', label: 'Medium' },
  Low: { color: '#3F8E5D', label: 'Low' },
};

function UploadForm({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [lat, setLat] = useState('18.5204');
  const [lng, setLng] = useState('73.8567');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setStatus('Choose an image first.'); return; }
    setStatus('Uploading...');
    const form = new FormData();
    form.append('image', file);
    form.append('lat', lat);
    form.append('lng', lng);
    try {
      const res = await axios.post('http://localhost:4000/detections', form);
      if (res.data.pothole) {
        setStatus('Pothole added.');
        onUploaded();
      } else {
        setStatus('No pothole detected in that image.');
      }
    } catch (err) {
      setStatus('Upload failed — check the backend is running.');
    }
  };

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <label className="filter-label">Report a pothole</label>
      <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} />
      <div className="coord-row">
        <input type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} placeholder="Latitude" />
        <input type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} placeholder="Longitude" />
      </div>
      <button type="submit">Submit</button>
      {status && <p className="upload-status">{status}</p>}
    </form>
  );
}

function App() {
  const [potholes, setPotholes] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchPotholes = () => {
    axios.get(`http://localhost:4000/potholes${statusFilter ? `?status=${statusFilter}` : ''}`)
      .then(res => setPotholes(res.data));
  };

  useEffect(() => { fetchPotholes(); }, [statusFilter]);

  const updateStatus = async (id, status) => {
    await axios.patch(`http://localhost:4000/potholes/${id}/status`, { status });
    setPotholes(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  const counts = useMemo(() => {
    const c = { Reported: 0, Acknowledged: 0, 'In Progress': 0, Resolved: 0 };
    potholes.forEach(p => { if (c[p.status] !== undefined) c[p.status]++; });
    return c;
  }, [potholes]);

  return (
    <div className="app">
      <header className="topbar">
        <h1>Road Watch</h1>
        <div className="stat-chips">
          {Object.entries(counts).map(([status, n]) => (
            <span key={status} className="chip">{status} <strong>{n}</strong></span>
          ))}
        </div>
      </header>

      <div className="body">
        <aside className="sidebar">
          <UploadForm onUploaded={fetchPotholes} />

          <label className="filter-label" htmlFor="status-filter">Filter by status</label>
          <select id="status-filter" className="filter-select" onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Reported">Reported</option>
            <option value="Acknowledged">Acknowledged</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>

          {potholes.length === 0 && (
            <p className="empty-state">No potholes match this filter.</p>
          )}

          <div className="ticket-list">
            {potholes.map(p => {
              const sev = SEVERITY[p.severity] || SEVERITY.Low;
              return (
                <div key={p.id} className="ticket" style={{ borderLeftColor: sev.color }}>
                  <div className="ticket-top">
                    <span className="ticket-id">#{String(p.id).padStart(4, '0')}</span>
                    <span className="severity-tag" style={{ color: sev.color }}>{sev.label}</span>
                  </div>
                  <div className="ticket-coords">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</div>
                  <select
                    className="status-select"
                    value={p.status}
                    onChange={e => updateStatus(p.id, e.target.value)}
                  >
                    <option>Reported</option>
                    <option>Acknowledged</option>
                    <option>In Progress</option>
                    <option>Resolved</option>
                  </select>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="map-wrap">
          <MapContainer center={[18.5204, 73.8567]} zoom={12} className="map">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {potholes.map(p => {
              const sev = SEVERITY[p.severity] || SEVERITY.Low;
              return (
                <CircleMarker
                  key={p.id}
                  center={[p.lat, p.lng]}
                  radius={9}
                  pathOptions={{ color: '#1F2321', weight: 1.5, fillColor: sev.color, fillOpacity: 0.9 }}
                >
                  <Popup>
                    <strong>{sev.label} severity</strong><br />
                    Status: {p.status}<br />
                    {p.image_url && <img src={p.image_url} width="150" alt="pothole" />}
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
          <div className="legend">
            {Object.values(SEVERITY).map(s => (
              <span key={s.label} className="legend-item">
                <span className="legend-dot" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
