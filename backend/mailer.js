async function sendReport(authorityEmail, pothole) {
  console.log('--- EMAIL WOULD BE SENT ---');
  console.log('To:', authorityEmail);
  console.log('Severity:', pothole.severity);
  console.log('Location:', `https://maps.google.com/?q=${pothole.lat},${pothole.lng}`);
  console.log('Image:', pothole.image_url);
  console.log('---------------------------');
}
module.exports = { sendReport };
