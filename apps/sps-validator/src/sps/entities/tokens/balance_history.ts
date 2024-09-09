import { inject, injectable } from 'tsyringe';
import { BalanceHistoryRepository, Handle, SocketLike } from '@steem-monsters/splinterlands-validator';

@injectable()
export class SpsBalanceHistoryRepository extends BalanceHistoryRepository {
    public constructor(@inject(Handle) handle: Handle, @inject(SocketLike) socket: SocketLike) {
        super(handle, socket);
    }
}
