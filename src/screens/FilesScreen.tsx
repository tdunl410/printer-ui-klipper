import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { BackButton, Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

interface FilePreview {
  thumbnailUrl?: string;
}

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
  const connection = usePrinterStore((state) => state.connection);
  const runAction = usePrinterStore((state) => state.runAction);
  const activeJob = usePrinterStore((state) => state.job);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [renameFilePath, setRenameFilePath] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [previews, setPreviews] = useState<Record<string, FilePreview>>({});

  useEffect(() => {
    const filesToLoad = files.filter((file) => !previews[file.path]);
    if (filesToLoad.length === 0) return;

    const encodePath = (path: string) => path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
    const dirname = (path: string) => {
      const index = path.lastIndexOf('/');
      return index >= 0 ? path.slice(0, index + 1) : '';
    };

    void Promise.all(
      filesToLoad.map(async (file) => {
        try {
          const response = await fetch(
            `${connection.moonrakerBaseUrl}/server/files/metadata?${new URLSearchParams({ filename: file.path })}`,
          );
          if (!response.ok) {
            return [file.path, {}] as const;
          }

          const payload = (await response.json()) as { result?: { thumbnails?: Array<{ relative_path?: string; width?: number }> } };
          const thumbs = payload.result?.thumbnails ?? [];
          const preferred = thumbs.slice().sort((a, b) => Number(b.width ?? 0) - Number(a.width ?? 0))[0];

          if (!preferred?.relative_path) {
            return [file.path, {}] as const;
          }

          const thumbnailPath = `${dirname(file.path)}${preferred.relative_path}`;
          const thumbnailUrl = `${connection.moonrakerBaseUrl}/server/files/gcodes/${encodePath(thumbnailPath)}`;
          return [file.path, { thumbnailUrl }] as const;
        } catch {
          return [file.path, {}] as const;
        }
      }),
    ).then((entries) => {
      setPreviews((prev) => {
        const next = { ...prev };
        entries.forEach(([path, preview]) => {
          next[path] = preview;
        });
        return next;
      });
    });
  }, [connection.moonrakerBaseUrl, files, previews]);

  const isPrinting = activeJob.state === 'printing' || activeJob.state === 'paused';
  const popupFile = useMemo(() => files.find((entry) => entry.path === openFile), [files, openFile]);
  const popupPreview = popupFile?.path ? previews[popupFile.path] : undefined;
  const popupModified = popupFile?.modified ? new Date(popupFile.modified * 1000).toLocaleString() : '-';
  const renameTarget = renameFilePath ? files.find((entry) => entry.path === renameFilePath) : undefined;

  return (
    <Layout title="Model Files" subtitle="USB + Local + Network">
      <section className="status-row">
        <article className="status-chip"><div className="k">Ready</div><div className="v">{files.length} Files</div></article>
        <article className="status-chip"><div className="k">Selected</div><div className="v">{selectedFile ? '1 File' : 'None'}</div></article>
        <article className="status-chip"><div className="k">Job</div><div className="v">{activeJob.state}</div></article>
      </section>

      <section className="card file-list-panel">
        <div className="card-label">Available GCODE</div>
        <div className="card-title">Files</div>
        <div className="file-list">
          {files.map((file) => (
            <button
              type="button"
              className={`file-item button-reset file-preview-item ${selectedFile?.path === file.path ? 'selected' : ''}`}
              key={file.path}
              onClick={() => {
                setSelectedFile(file.path);
                setOpenFile(file.path);
              }}
            >
              <span className="file-thumb">
                {previews[file.path]?.thumbnailUrl ? (
                  <img src={previews[file.path].thumbnailUrl} alt={`${file.path} preview`} />
                ) : (
                  <span className="file-thumb-placeholder">No Preview</span>
                )}
              </span>
              <span className="file-path">{file.path}</span>
            </button>
          ))}
        </div>
        {files.length === 0 ? <div className="macro-item">No files found in gcodes.</div> : null}
      </section>

      <BackButton to="/settings" />

      {popupFile ? (
        <Dialog
          subtitle="Selected File"
          title={popupFile.path}
          actions={[
            {
              label: 'Print',
              variant: 'accent',
              disabled: isPrinting,
              onClick: () => {
                void runAction('Print Selected', () => commands.startPrint(popupFile.path));
                setOpenFile(null);
              },
            },
            {
              label: 'Rename',
              onClick: () => {
                setRenameFilePath(popupFile.path);
                setRenameDraft(popupFile.path);
                setOpenFile(null);
              },
            },
            { label: 'Close', onClick: () => setOpenFile(null) },
          ]}
        >
          <div className="media-thumb thumb-gap file-selected-thumb">
            {popupPreview?.thumbnailUrl ? (
              <img src={popupPreview.thumbnailUrl} alt={`${popupFile.path} preview`} />
            ) : (
              <div className="file-thumb-placeholder">No Preview</div>
            )}
          </div>
          <div className="kv"><span>Name</span><strong>{popupFile.path}</strong></div>
          <div className="kv"><span>Size</span><strong>{bytesToSize(popupFile.size)}</strong></div>
          <div className="kv"><span>Modified</span><strong>{popupModified}</strong></div>
        </Dialog>
      ) : null}

      {renameTarget ? (
        <Dialog
          subtitle="Rename File"
          title={renameTarget.path}
          actions={[
            {
              label: 'Save',
              variant: 'accent',
              disabled: !renameDraft || renameDraft === renameTarget.path,
              onClick: () => {
                const nextName = renameDraft.trim();
                if (!nextName || nextName === renameTarget.path) return;
                void runAction('Rename File', async () => {
                  await commands.renameFile(renameTarget.path, nextName);
                  setSelectedFile(nextName);
                });
                setRenameFilePath(null);
              },
            },
            {
              label: 'Cancel',
              onClick: () => {
                setRenameFilePath(null);
                setRenameDraft('');
              },
            },
          ]}
        >
          <label className="field-label">New file name</label>
          <input className="input" value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} />
        </Dialog>
      ) : null}
    </Layout>
  );
}
