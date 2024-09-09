import { inject, injectable, singleton } from 'tsyringe';
import { DelayedSocket, SocketLike, SocketOptions, SocketWrapper } from '@steem-monsters/splinterlands-validator';

@injectable()
export class SpsSocketWrapper extends SocketWrapper {
    public constructor(@inject(SocketOptions) cfg: SocketOptions) {
        super(cfg);
    }
}

@singleton()
export class SpsDelayedSocket extends DelayedSocket {
    public constructor(@inject(SocketWrapper) socket: SocketLike) {
        super(socket);
    }
}
