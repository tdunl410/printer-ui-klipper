const printerRenderUrls = import.meta.glob<string>('../../assets/printer-render*', {
  eager: true,
  import: 'default',
  query: '?url',
});

export const printerRenders = Object.entries(printerRenderUrls)
  .filter(([path]) => /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(path))
  .map(([path, src]) => ({
    name: path.split('/').pop()!,
    label: path.split('/').pop()!.replace(/\.[^.]+$/, ''),
    src,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

export const defaultPrinterRender = printerRenders.find((render) => render.name === 'printer-render.png')
  ?? printerRenders[0];
