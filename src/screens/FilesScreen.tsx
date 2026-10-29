import { BackButton, Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

function bytesToSize(value?: number) {
  if (!value || value <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function FilesScreen() {
  const commands = useCommands();
  const files = usePrinterStore((state) => state.files);
  const selectedFile = usePrinterStore((state) => state.selectedFile);
  const setSelectedFile = usePrinterStore((state) => state.setSelectedFile);
  const runAction = usePrinterStore((state) => state.runAction);
  const activeJob = usePrinterStore((state) => state.job);

  const isPrinting = activeJob.state === 'printing' || activeJob.state === 'paused';
  const selectedModified = selectedFile?.modified ? new Date(selectedFile.modified * 1000).toLocaleString() : '-';

  return (
    <Layout title="Model Files" subtitle="USB + Local + Network">
      <section className="status-row">
        <article className="status-chip"><div className="k">Ready</div><div className="v">{files.length} Files</div></article>
        <article className="status-chip"><div className="k">Selected</div><div className="v">{selectedFile ? '1 File' : 'None'}</div></article>
        <article className="status-chip"><div className="k">Job</div><div className="v">{activeJob.state}</div></article>
      </section>

      <section className="card">
        <div className="card-label">Available GCODE</div>
        <div className="card-title">Files</div>
        {files.map((file) => (
          <button
            type="button"
            className={`file-item button-reset ${selectedFile?.path === file.path ? 'selected' : ''}`}
            key={file.path}
            onClick={() => setSelectedFile(file.path)}
          >
            {file.path}
          </button>
        ))}
        {files.length === 0 ? <div className="macro-item">No files found in gcodes.</div> : null}
      </section>

      <section className="card">
        <div className="card-label">Selected File</div>
        <div className="card-title">Selected File</div>
        <div className="kv"><span>Name</span><strong>{selectedFile?.path || 'None selected'}</strong></div>
        <div className="kv"><span>Size</span><strong>{bytesToSize(selectedFile?.size)}</strong></div>
        <div className="kv"><span>Modified</span><strong>{selectedModified}</strong></div>
      </section>

      <section className="card">
        <div className="card-label">Actions</div>
        <div className="btn-row">
          <button
            type="button"
            className="btn accent"
            disabled={!selectedFile || isPrinting}
            onClick={() => {
              if (!selectedFile) return;
              void runAction('Print Selected', () => commands.startPrint(selectedFile.path));
            }}
          >
            Print Now
          </button>
          <button
            type="button"
            className="btn"
            disabled={!selectedFile || isPrinting}
            onClick={() => {
              if (!selectedFile) return;
              const nextName = window.prompt('Rename file to:', selectedFile.path);
              if (!nextName || nextName === selectedFile.path) return;
              void runAction('Rename File', async () => {
                await commands.renameFile(selectedFile.path, nextName);
                setSelectedFile(nextName);
              });
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="btn"
            disabled={!selectedFile || isPrinting}
            onClick={() => {
              if (!selectedFile) return;
              if (!window.confirm(`Delete ${selectedFile.path}?`)) return;
              void runAction('Delete File', async () => {
                await commands.deleteFile(selectedFile.path);
              });
            }}
          >
            Delete
          </button>
        </div>
      </section>

      <BackButton to="/settings" />
    </Layout>
  );
}
