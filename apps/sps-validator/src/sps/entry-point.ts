import { DependencyContainer, inject, singleton } from 'tsyringe';
import { Knex } from 'knex';
import { SpsDelayedSocket } from './socket';
import { SpsSynchronisationConfig } from './sync';
import {
    BlockProcessor,
    BlockRepository,
    ConditionalApiActivator,
    DelayedSocket,
    EntryOptions,
    EntryPoint,
    HiveStream,
    KnexToken,
    LastBlockCache,
    PluginDispatcher,
    Primer,
    Snapshot,
} from '@steem-monsters/splinterlands-validator';

@singleton()
export class SpsEntryPoint extends EntryPoint<DependencyContainer, SpsSynchronisationConfig> {
    public constructor(
        @inject(Primer) primer: Primer,
        @inject(EntryOptions) cfg: EntryOptions,
        @inject(KnexToken) knex: Knex,
        @inject(Snapshot) snap: Snapshot<DependencyContainer>,
        @inject(HiveStream) stream: HiveStream,
        @inject(SpsDelayedSocket) socket: DelayedSocket,
        @inject(BlockProcessor) processor: BlockProcessor<SpsSynchronisationConfig>,
        @inject(BlockRepository) blockRepository: BlockRepository,
        @inject(LastBlockCache) lastBlockCache: LastBlockCache,
        @inject(ConditionalApiActivator) activator: ConditionalApiActivator,
        @inject(PluginDispatcher) pluginDispatcher: PluginDispatcher,
    ) {
        super(primer, cfg, knex, snap, stream, socket, processor, blockRepository, lastBlockCache, activator, pluginDispatcher);
    }
}
