require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function uploadFile() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const folderId = '1L_TJrrzfFHDrsYYY83vjzt-jSOs0JNqE';
  const filePath = path.join(__dirname, '..', '..', 'docs', 'login-info.md');

  if (!serviceAccountEmail || !privateKey) {
    console.error('Google credentials not found');
    process.exit(1);
  }

  const auth = new google.auth.JWT(
    serviceAccountEmail,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/drive.file']
  );

  const drive = google.drive({ version: 'v3', auth });

  const fileContent = fs.readFileSync(filePath, 'utf8');

  // Check if file already exists
  const existingFiles = await drive.files.list({
    q: `name='login-info.md' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (existingFiles.data.files && existingFiles.data.files.length > 0) {
    // Update existing file
    const fileId = existingFiles.data.files[0].id;
    await drive.files.update({
      fileId: fileId,
      media: {
        mimeType: 'text/markdown',
        body: fileContent,
      },
      supportsAllDrives: true,
    });
    console.log('File updated:', fileId);
  } else {
    // Create new file
    const response = await drive.files.create({
      requestBody: {
        name: 'login-info.md',
        parents: [folderId],
      },
      media: {
        mimeType: 'text/markdown',
        body: fileContent,
      },
      supportsAllDrives: true,
      fields: 'id, name, webViewLink',
    });
    console.log('File created:', response.data.id);
    console.log('Link:', response.data.webViewLink);
  }

  console.log('Done!');
}

uploadFile().catch(console.error);
