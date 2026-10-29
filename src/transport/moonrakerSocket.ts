type SocketHandler = (payload: unknown) => void;

export class MoonrakerSocket {
  private socket?: WebSocket;
  private reconnectTimer?: number;
  private rpcId = 1;
  private extraObjects = new Set<string>();

  constructor(
    private readonly wsUrl: string,
    private readonly subscribeObjects: string[],
    private readonly onOpen: () => void,
    private readonly onClose: () => void,
    private readonly onMessage: SocketHandler,
  ) {}

  connect() {
    this.clearReconnect();
    this.socket = new WebSocket(this.wsUrl);

    this.socket.addEventListener('open', () => {
      this.onOpen();
      this.sendSubscribe([...this.subscribeObjects, ...this.extraObjects]);
    });

    this.socket.addEventListener('message', (event) => {
      try {
        this.onMessage(JSON.parse(event.data));
      } catch {
        this.onMessage(event.data);
      }
    });

    this.socket.addEventListener('close', () => {
      this.onClose();
      this.reconnectTimer = window.setTimeout(() => this.connect(), 2500);
    });

    this.socket.addEventListener('error', () => {
      this.socket?.close();
    });
  }

  // A subscribe call replaces the connection's previous subscription, so always send the full set.
  subscribe(objects: string[]) {
    const added = objects.filter((name) => !this.extraObjects.has(name) && !this.subscribeObjects.includes(name));
    if (added.length === 0) return;
    added.forEach((name) => this.extraObjects.add(name));
    this.sendSubscribe([...this.subscribeObjects, ...this.extraObjects]);
  }

  private sendSubscribe(objects: string[]) {
    this.send({
      jsonrpc: '2.0',
      method: 'printer.objects.subscribe',
      params: {
        objects: objects.reduce<Record<string, null>>((acc, name) => {
          acc[name] = null;
          return acc;
        }, {}),
      },
      id: this.rpcId++,
    });
  }

  send(message: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  close() {
    this.clearReconnect();
    this.socket?.close();
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}
