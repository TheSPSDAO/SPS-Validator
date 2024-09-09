import { inject, injectable, singleton } from 'tsyringe';
import { BlockRepository, Handle, HiveAccountRepository, LastBlockCache, SocketLike, TransactionRepository } from '@steem-monsters/splinterlands-validator';

@injectable()
export class SpsTransactionRepository extends TransactionRepository {
    public constructor(@inject(Handle) handle: Handle, @inject(SocketLike) socket: SocketLike) {
        super(handle, socket);
    }
}

@injectable()
export class SpsBlockRepository extends BlockRepository {
    public constructor(@inject(Handle) handle: Handle, @inject(TransactionRepository) transactionRepository: TransactionRepository) {
        super(handle, transactionRepository);
    }
}

@injectable()
export class SpsHiveAccountRepository extends HiveAccountRepository {
    constructor(@inject(Handle) handle: Handle) {
        super(handle);
    }
}

@singleton()
export class SpsLastBlockCache extends LastBlockCache {
    constructor(@inject(BlockRepository) blockRepository: BlockRepository) {
        super(blockRepository);
    }
}
