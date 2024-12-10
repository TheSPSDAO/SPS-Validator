import WebSocket from 'ws';
import * as utils from './utils';
import { LogLevel } from './utils';

export interface SocketLike {
    send<T>(account: string, id: string, data: T): void;
    perhapsConnect(): SocketLike;
}

export const SocketLike: unique symbol = Symbol('SocketLike');

export type SocketOptions = {
    socket_url: string | null;
    socket_key: string | null;
};

export const SocketOptions: unique symbol = Symbol('SocketOptions');

export class SocketWrapper implements SocketLike {
    private ws: WebSocket | null = null;

    private readonly socket_url: string | null;
    private readonly secret_key: string | null;

    public constructor(cfg: SocketOptions) {
        this.socket_url = cfg.socket_url;
        this.secret_key = cfg.socket_key;
    }

    public connect() {
        if (!this.socket_url) {
            return;
        }

        try {
            this.ws = new WebSocket(this.socket_url);

            this.ws.on('open', () => {
                utils.log(`Socket connected to ${this.socket_url}!`);
                this.ws?.send(JSON.stringify({ type: 'auth', player: `$SPS_VALIDATOR` }));
            });

            this.ws.on('error', (e) => utils.log(`Socket connection error: ${e}`));

            this.ws.on('close', () => {
                utils.log('Socket disconnected...', LogLevel.Error, 'Red');
                setTimeout(() => this.connect(), 100);
            });
        } catch (err) {
            utils.log(`Socket connection error: ${err}`, LogLevel.Error, 'Red');
        }
    }

    public perhapsConnect() {
        if (!this.ws) {
            this.connect();
        }
        return this;
    }

    public send<T>(account: string, id: string, data: T) {
        if (!this.ws || this.ws.readyState === 3) return;

        const msg = {
            type: 'proxy_message',
            player: account,
            id,
            data,
            secret_key: this.secret_key,
        };

        try {
            this.ws.send(JSON.stringify(msg));
        } catch (err: any) {
            utils.log(`Error sending socket message: ${err && err.message ? err.message : err}`, LogLevel.Error, 'Red');
        }
    }
}

export class DelayedSocket implements SocketLike {
    private readonly messages: Array<{ account: string; id: string; data: unknown }> = [];
    public constructor(private readonly socket: SocketLike) {}

    send<T>(account: string, id: string, data: T) {
        this.messages.push({ account, id, data });
    }

    sendDelayedBulk() {
        for (const message of this.messages) {
            this.socket.send(message.account, message.id, message.data);
        }
        this.clearDelayed();
    }

    clearDelayed() {
        // This actually frees the memory of the array, while still allowing it to be a readonly/const.
        this.messages.length = 0;
    }

    perhapsConnect() {
        this.socket.perhapsConnect();
        return this;
    }
}
