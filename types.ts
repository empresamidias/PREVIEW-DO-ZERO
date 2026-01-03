
export interface ProjectData {
  id: string;
  files: string[];
  readyToRun?: boolean;
}

export interface VirtualFile {
  path: string;
  content: string;
  isBinary: boolean;
}

export interface TerminalLog {
  id: string;
  text: string;
  type: 'info' | 'success' | 'error' | 'command' | 'warning';
  timestamp: string;
}

export enum Status {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}
