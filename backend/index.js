const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const pool = require('./db');
const { sendReport } = require('./mailer');
const { findAuthorityForLocation } = require('./authority');

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// Serve uploaded images statically (swap for S3/R2 later)
app.use('/uploads', express.static('uploads'));

app.post('/detections', upload.single('image'), async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const form = new FormData();
    form.append('file', fs.createReadStream(req.file.path));

    const detectResp = await axios.post(process.env.DETECTION_SERVICE_URL, form, {
      headers: form.getHeaders()
    });

    if (!detectResp.data.pothole_found) {
      return res.json({ message: 'No pothole detected', detections: [] });
    }

    const topSeverity = detectResp.data.detections
      .map(d => d.severity)
      .sort((a, b) => ({High:3,Medium:2,Low:1}[b] - {High:3,Medium:2,Low:1}[a]))[0];

    const authority = await findAuthorityForLocation(lat, lng);
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    const insert = await pool.query(
      `INSERT INTO potholes (lat, lng, severity, image_url, authority_id, status)
       VALUES ($1,$2,$3,$4,$5,'Reported') RETURNING *`,
      [lat, lng, topSeverity, imageUrl, authority ? authority.id : null]
    );
    const pothole = insert.rows[0];

    if (authority) {
      await sendReport(authority.contact_email, pothole);
    }

    res.json({ pothole, authority });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/potholes', async (req, res) => {
  const { status, severity } = req.query;
  let query = 'SELECT * FROM potholes WHERE 1=1';
  const params = [];
  if (status) { params.push(status); query += ` AND status = $${params.length}`; }
  if (severity) { params.push(severity); query += ` AND severity = $${params.length}`; }
  if (req.query.authority_id) { params.push(req.query.authority_id); query += ` AND authority_id = $${params.length}`; }
  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  res.json(result.rows);
});

app.patch('/potholes/:id/status', async (req, res) => {
  const { status } = req.body;
  await pool.query('UPDATE potholes SET status=$1 WHERE id=$2', [status, req.params.id]);
  await pool.query('INSERT INTO status_history (pothole_id, status) VALUES ($1,$2)', [req.params.id, status]);
  res.json({ ok: true });
});


app.get('/authorities', async (req, res) => {
  const result = await pool.query('SELECT * FROM authorities ORDER BY name');
  res.json(result.rows);
});

app.listen(4000, () => console.log('Backend running on port 4000'));