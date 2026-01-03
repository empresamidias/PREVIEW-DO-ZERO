import JSZip from 'jszip';
import type { ProjectData, VirtualFile } from '../types';

const API_BASE = 'https://lineable-maricela-primly.ngrok-free.dev';

export const fetchProjectsList = async (): Promise<ProjectData[]> => {
  const res = await fetch(`${API_BASE}/projects/`, {
    headers: { 'ngrok-skip-browser-warning': 'true' }
  });
  if (!res.ok) throw new Error(`Erro ao buscar projetos (${res.status})`);
  return res.json();
};

export const downloadAndUnzip = async (projectId: string, fileName: string): Promise<Record<string, VirtualFile>> => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/download/${fileName}`, {
    headers: { 'ngrok-skip-browser-warning': 'true' }
  });
  if (!res.ok) throw new Error(`Erro ao baixar ZIP (${res.status})`);
  const blob = await res.blob();

  const zip = await JSZip.loadAsync(blob);
  const files: Record<string, VirtualFile> = {};

  const promises: Promise<void>[] = [];
  zip.forEach((relativePath, file) => {
    if (!file.dir) {
      promises.push(
        file.async('string').then(content => {
          files[relativePath] = { path: relativePath, content, isBinary: false };
        })
      );
    }
  });

  await Promise.all(promises);

  // Validação de arquivos obrigatórios
  const requiredFiles = ['index.html', 'package.json', 'vite.config.ts'];
  for (const f of requiredFiles) {
    if (!files[f] && !Object.keys(files).some(k => k.endsWith(f))) {
      console.warn(`Aviso: arquivo obrigatório não encontrado: ${f}`);
    }
  }

  return files;
};
