import fs from 'fs';
import path from 'path';
import https from 'https';
import { spawn } from 'child_process';
import JSZip from 'jszip';

export default async function downloadProject(projectId, zipUrl) {
  const projectDir = path.join(process.cwd(), 'projects', projectId);
  fs.mkdirSync(projectDir, { recursive: true });

  const zipFilePath = path.join(projectDir, 'project.zip');

  // 1️⃣ Baixar ZIP
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(zipFilePath);
    https.get(zipUrl, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`Falha ao baixar ZIP: ${res.statusCode}`));
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath);
      reject(err);
    });
  });

  // 2️⃣ Descompactar ZIP
  const data = fs.readFileSync(zipFilePath);
  const zip = await JSZip.loadAsync(data);

  for (const relativePath in zip.files) {
    const file = zip.files[relativePath];
    if (!file.dir) {
      const filePath = path.join(projectDir, relativePath);
      const dirPath = path.dirname(filePath);
      fs.mkdirSync(dirPath, { recursive: true });
      const content = await file.async('nodebuffer');
      fs.writeFileSync(filePath, content);
    }
  }

  // 3️⃣ Rodar npm install com spawn
  await new Promise((resolve, reject) => {
    console.log(`Executando npm install em ${projectDir}...`);
    const npm = spawn('npm', ['install'], { cwd: projectDir, shell: true });

    npm.stdout.on('data', (data) => console.log(data.toString()));
    npm.stderr.on('data', (data) => console.error(data.toString()));

    npm.on('close', (code) => {
      if (code === 0) {
        console.log('npm install finalizado com sucesso!');
        resolve();
      } else {
        reject(new Error(`npm install falhou com código ${code}`));
      }
    });
  });

  return projectDir;
}
