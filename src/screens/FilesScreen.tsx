import { BackButton, Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

export function FilesScreen() {
  const commands = useCommands();
  const files = usePrinterStore((state) => state.files);
  const selectedFile = usePrinterStore((state) => state.selectedFile);
  const setSelectedFile = usePrinterStore((state) => state.setSelectedFile);
  const runAction = usePrinterStore((state) => state.runAction);

  return (
    <Layout title="Model Files" subtitle="USB + Local + Network">
      <section className="status-row">
        <article className="status-chip"><div className="k">Ready</div><div className="v">{files.length} Files</div></article>
        <article className="status-chip"><div className="k">Storage</div><div className="v">3.2 GB</div></article>
        <article className="status-chip"><div className="k">Queue</div><div className="v">1 Job</div></article>
      </section>

      <section className="card">
        <div className="card-label">Recent Jobs</div>
        <div className="card-title">Recent</div>
        {files.slice(0, 6).map((file) => (
          <button
            type="button"
            className={`file-item button-reset ${selectedFile?.path === file.path ? 'selected' : ''}`}
            key={file.path}
            onClick={() => setSelectedFile(file.path)}
          >
            {file.path}
          </button>
        ))}
      </section>

      <section className="card">
        <div className="card-label">Selected File</div>
        <div className="card-title">Selected File</div>
        <div className="media-thumb thumb-gap">
          <img src="/assets/printer-render.png" alt="Selected file preview" />
        </div>
        <div className="kv"><span>Name</span><strong>{selectedFile?.path || 'None selected'}</strong></div>
        <div className="kv"><span>Material</span><strong>ASA</strong></div>
        <div className="kv"><span>Est. Time</span><strong>4h 52m</strong></div>
        <div className="kv"><span>Layer Height</span><strong>0.20mm</strong></div>
      </section>

      <section className="card">
        <div className="card-label">Actions</div>
        <div className="btn-row">
          <button
            type="button"
            className="btn accent"
            disabled={!selectedFile}
            onClick={() => runAction('Print Selected', () => commands.runMacro(`SDCARD_PRINT_FILE FILENAME=\"${selectedFile?.path || ''}\"`))}
          >
            Print Now
          </button>
          <button type="button" className="btn" disabled>
            Rename
          </button>
          <button type="button" className="btn" disabled>
            Delete
          </button>
        </div>
      </section>

      <BackButton to="/settings" />
    </Layout>
  );
}
