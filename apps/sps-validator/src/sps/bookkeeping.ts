import { inject, singleton } from 'tsyringe';
import { BookkeepingFromConfig, BookkeepingWatch } from '@steem-monsters/splinterlands-validator';
import { BookkeepingDefault } from '@steem-monsters/splinterlands-validator';

@singleton()
export class SpsBookkeeping extends BookkeepingFromConfig {
    constructor(@inject(BookkeepingWatch) watcher: BookkeepingWatch) {
        super(watcher, BookkeepingDefault.DOLLAR_ONLY);
    }
}
