type SocketHandler = (payload: unknown) => void;

export class MoonrakerSocket {
  private socket?: WebSocket;
  private reconnectTimer?: number;
  private rpcId = 1;

  constructor(
    private readonly wsUrl: string,
    private readonly onOpen: () => void,
    private readonly onClose: () => void,
    private readonly onMessage: SocketHandler,
  ) {}

  connect() {
    this.clearReconnect();
    this.socket = new WebSocket(this.wsUrl);

    this.socket.addEventListener('open', () => {
      this.onOpen();
      this.send({
        jsonrpc: '2.0',
        method: 'printer.objects.subscribe',
        params: {
          objects: {
            toolhead: null,
            extruder: null,
            heater_bed: null,
            print_stats: null,
            display_status: null,
            fan: null,
            idle_timeout: null,
          },
        },
        id: this.rpcId++,
      });
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
