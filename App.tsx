
import React, { useEffect, useState } from 'react';
import { 
  FolderCode, 
  Play, 
  Download, 
  Globe, 
  Files, 
  Terminal, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  ChevronRight,
  ExternalLink,
  Search,
  RefreshCw,
  RefreshCcw,
  MessageSquare
} from 'lucide-react';
import { fetchProjectsList, downloadAndUnzip } from './services/api';
import { supabase } from './supabase';
import { ProjectData, VirtualFile, Status } from './types';

interface ProjectDataWithStatus extends ProjectData {
  readyToRun?: boolean;
}

const App: React.FC = () => {
  const [projects, setProjects] = useState<ProjectDataWithStatus[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<string, VirtualFile>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readyToRun, setReadyToRun] = useState(false);
  const [viewMode, setViewMode] = useState<'files' | 'preview' | 'prompt'>('files');
  const [logs, setLogs] = useState<string[]>(["System initialized...", "Ready for project selection."]);
  
  // Prompt states
  const [prompt, setPrompt] = useState('');
  const [dbStatus, setDbStatus] = useState<Status>(Status.IDLE);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const list = await fetchProjectsList();
      const listWithStatus = await Promise.all(
        list.map(async (p) => {
          try {
            const res = await fetch(`http://localhost:4000/project-status/${p.id}`);
            const status = await res.json();
            return { ...p, readyToRun: status.readyToRun };
          } catch {
            return { ...p, readyToRun: false };
          }
        })
      );
      setProjects(listWithStatus);
      addLog(`Loaded ${list.length} projects from API.`);
    } catch (err: any) {
      setError('Connection failed. Make sure local server is running.');
      addLog(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProject = async (project: ProjectDataWithStatus) => {
    setActiveProjectId(project.id);
    setFiles({});
    setLoading(true);
    setError(null);
    setReadyToRun(false);
    setViewMode('files');
    addLog(`Selecting project: ${project.id}`);

    try {
      if (project.readyToRun) {
        setReadyToRun(true);
        addLog(`Project ${project.id} is already cached and ready.`);
        const unpackedFiles = await downloadAndUnzip(project.id, project.files[0] || 'project.zip');
        setFiles(unpackedFiles);
      } else {
        addLog(`Project ${project.id} needs to be downloaded...`);
      }
    } catch (err: any) {
      addLog(`Warning: Could not fetch file list immediately.`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAndInstall = async () => {
    if (!activeProjectId) return;
    const project = projects.find(p => p.id === activeProjectId);
    if (!project) return;

    setLoading(true);
    addLog(`Starting download and npm install for ${activeProjectId}...`);
    
    try {
      const fileName = project.files[0] || 'project.zip';
      const zipUrl = `https://lineable-maricela-primly.ngrok-free.dev/projects/${project.id}/download/${fileName}`;

      const res = await fetch('http://localhost:4000/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, zipUrl })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Download error');

      addLog(`Installation successful at: ${data.path}`);
      setReadyToRun(true);
      
      const unpackedFiles = await downloadAndUnzip(project.id, fileName);
      setFiles(unpackedFiles);
      loadProjects(); 
    } catch (err: any) {
      setError(err.message);
      addLog(`Fatal Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRunProject = async () => {
    if (!activeProjectId) return;
    addLog(`Launching preview for ${activeProjectId}...`);
    try {
      const res = await fetch('http://localhost:4000/run-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Execution error');
      }
      addLog(`Project running! Port assigned. Switching to preview.`);
      setViewMode('preview');
    } catch (err: any) {
      setError(err.message);
      addLog(`Error: ${err.message}`);
    }
  };

  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setDbStatus(Status.LOADING);
    addLog("Iniciando sincronização com Supabase...");

    try {
      const { error } = await supabase
        .from('prompts')
        .insert([{ 
          content: prompt, 
          project_id: activeProjectId,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      setDbStatus(Status.SUCCESS);
      addLog("Dados sincronizados com sucesso no Supabase.");
      setTimeout(() => setDbStatus(Status.IDLE), 3000);
    } catch (err: any) {
      console.error(err);
      setDbStatus(Status.ERROR);
      addLog(`Erro ao sincronizar: ${err.message}`);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#0f172a] text-slate-300 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-[#1e293b] border-r border-slate-800 flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <FolderCode size={20} className="text-white" />
          </div>
          <h1 className="font-bold text-lg text-white tracking-tight">Project Hub</h1>
        </div>

        <div className="p-4">
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-500" />
            <input 
              placeholder="Search projects..." 
              className="w-full bg-[#0f172a] border border-slate-700 rounded-md py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          
          <div className="flex items-center justify-between mb-2 px-2">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Available</span>
            <button onClick={loadProjects} className="hover:text-indigo-400 transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelectProject(p)}
              className={`group w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                activeProjectId === p.id 
                ? 'bg-indigo-600/10 border border-indigo-500/30 text-white' 
                : 'hover:bg-slate-800 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <ChevronRight size={14} className={`${activeProjectId === p.id ? 'text-indigo-400' : 'text-slate-600 opacity-0 group-hover:opacity-100'}`} />
                <span className="truncate font-medium text-sm">{p.id}</span>
              </div>
              {p.readyToRun && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
            </button>
          ))}
        </nav>

        <div className="p-4 bg-[#1e293b] border-t border-slate-800">
           <div className="flex items-center gap-2 text-xs text-slate-500">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             Local Server Connected
           </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0f172a]">
        <header className="h-16 bg-[#1e293b] border-b border-slate-800 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-4">
            {activeProjectId ? (
              <h2 className="text-white font-semibold flex items-center gap-2">
                {activeProjectId}
                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-tighter ${readyToRun ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {readyToRun ? 'Installed' : 'Pending'}
                </span>
              </h2>
            ) : (
              <p className="text-slate-500 text-sm">Select a project to begin</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!readyToRun && activeProjectId && (
              <button
                disabled={loading}
                onClick={handleDownloadAndInstall}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-md text-sm font-medium transition-all shadow-lg"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                Install Dependencies
              </button>
            )}
            
            {readyToRun && (
              <button
                onClick={handleRunProject}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium transition-all shadow-lg shadow-emerald-500/10"
              >
                <Play size={16} fill="currentColor" />
                Run / Preview
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex bg-[#1e293b] px-4 gap-1">
            <button 
              onClick={() => setViewMode('files')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${viewMode === 'files' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              <Files size={14} /> Files
            </button>
            <button 
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${viewMode === 'preview' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              <Globe size={14} /> Preview
            </button>
            <button 
              onClick={() => setViewMode('prompt')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${viewMode === 'prompt' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              <MessageSquare size={14} /> Prompt
            </button>
          </div>

          <div className="flex-1 relative overflow-hidden bg-[#0a0f1d]">
            {viewMode === 'files' && (
              <div className="absolute inset-0 p-6 overflow-y-auto custom-scrollbar">
                {Object.keys(files).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.keys(files).map((path) => (
                      <div key={path} className="flex items-center gap-3 p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg hover:border-slate-500 transition-colors">
                        <Files size={18} className="text-indigo-400 shrink-0" />
                        <span className="text-sm truncate text-slate-300 mono">{path}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 opacity-50">
                    <Files size={48} />
                    <p className="text-center">No files to display.</p>
                  </div>
                )}
              </div>
            )}

            {viewMode === 'preview' && (
              <div className="absolute inset-0 flex flex-col">
                <div className="bg-[#1e293b] p-2 flex items-center gap-4 border-b border-slate-800">
                  <div className="flex items-center gap-2 px-3 py-1 bg-[#0f172a] rounded-full border border-slate-700 flex-1 max-w-xl">
                    <Globe size={12} className="text-slate-500" />
                    <span className="text-[10px] text-slate-400 truncate">http://localhost:3001/</span>
                  </div>
                  <a href="http://localhost:3001/" target="_blank" className="p-1 hover:bg-slate-700 rounded text-slate-400">
                    <ExternalLink size={14} />
                  </a>
                </div>
                <iframe src="http://localhost:3001/" className="flex-1 w-full bg-white border-none" title="Project Preview"></iframe>
              </div>
            )}

            {viewMode === 'prompt' && (
              <div className="absolute inset-0 p-8 overflow-y-auto custom-scrollbar bg-[#0f172a]">
                <div className="max-w-4xl mx-auto">
                  <form onSubmit={handlePromptSubmit} className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <label className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">
                        Entrada de Mensagem
                      </label>
                      <div className="flex items-center gap-2 text-[9px] text-gray-600 font-mono">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        SUPABASE CONNECTED
                      </div>
                    </div>

                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-white min-h-[400px] focus:ring-1 focus:ring-indigo-500 outline-none font-mono text-sm leading-relaxed transition-all placeholder:text-gray-800"
                      placeholder="Cole seu prompt ou código aqui para salvar no banco de dados..."
                    />

                    <button
                      type="submit"
                      disabled={dbStatus === Status.LOADING || !prompt.trim()}
                      className="w-full mt-6 py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 disabled:text-gray-700 text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-600/10 active:scale-[0.98] uppercase text-xs tracking-widest"
                    >
                      {dbStatus === Status.LOADING ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        <>
                          <RefreshCcw size={18} />
                          Sincronizar com Supabase
                        </>
                      )}
                    </button>

                    <div className="mt-4 h-6 text-center">
                      {dbStatus === Status.ERROR && <span className="text-red-500 text-[10px] font-bold uppercase tracking-widest">Erro na transação. Verifique a rede.</span>}
                      {dbStatus === Status.SUCCESS && <span className="text-green-500 text-[10px] font-bold uppercase tracking-widest">Sincronizado com sucesso!</span>}
                    </div>
                  </form>
                </div>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 bg-[#1e293b] p-8 rounded-2xl shadow-2xl border border-slate-700">
                  <Loader2 className="animate-spin text-indigo-500" size={40} />
                  <div className="text-center text-white">
                    <p className="font-medium">Processando Requisição</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <footer className="h-40 bg-[#0a0f1d] border-t border-slate-800 flex flex-col">
             <div className="px-4 py-2 bg-[#1e293b] border-b border-slate-800 flex items-center gap-2">
                <Terminal size={12} className="text-slate-500" />
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Console Output</span>
             </div>
             <div className="flex-1 overflow-y-auto p-4 mono text-xs text-emerald-500/80 custom-scrollbar space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-700 select-none">$</span>
                    <span>{log}</span>
                  </div>
                ))}
             </div>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default App;
