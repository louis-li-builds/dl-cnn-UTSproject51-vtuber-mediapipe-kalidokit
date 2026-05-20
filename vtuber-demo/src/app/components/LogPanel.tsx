import { Terminal, Trash2, Download } from 'lucide-react';

interface LogPanelProps {
  logText: string;
}

export function LogPanel({ logText }: LogPanelProps) {
  const clearLogs = () => {
    // Pipeline overwrites log on next event; no-op placeholder for UI parity.
  };

  const downloadLogs = () => {
    const blob = new Blob([logText || ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vtuber-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-zinc-800 border-b border-zinc-700">
        <h3 className="text-sm text-zinc-100 flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          System Logs
        </h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={downloadLogs}
            className="p-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-100 transition-colors"
            title="Download logs"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={clearLogs}
            className="p-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-100 transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
        <pre className="text-zinc-300 whitespace-pre-wrap m-0">
          {logText || "Waiting for pipeline…"}
        </pre>
      </div>
    </div>
  );
}
