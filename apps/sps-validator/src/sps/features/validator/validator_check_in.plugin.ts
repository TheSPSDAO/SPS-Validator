import { EventLog, HiveClient, LogLevel, Plugin, Prime, Trx, log } from '@steem-monsters/splinterlands-validator';
import { inject, singleton } from 'tsyringe';
import config from '../../convict-config';
import { SpsValidatorCheckInRepository } from '../../entities/validator/validator_check_in';
import { ValidatorCheckInWatch } from './validator_license.config';
import { SpsValidatorLicenseManager } from './validator_license.manager';

@singleton()
export class ValidatorCheckInPlugin implements Plugin, Prime {
    readonly name = 'validator_check_in';

    private readonly checkInAccount: string;

    private primed = false;
    private nextCheckInBlock: number | undefined;

    constructor(
        @inject(SpsValidatorCheckInRepository)
        private readonly checkInRepository: SpsValidatorCheckInRepository,
        @inject(ValidatorCheckInWatch)
        private readonly checkInWatcher: ValidatorCheckInWatch,
        @inject(HiveClient)
        private readonly hive: HiveClient,
        @inject(SpsValidatorLicenseManager)
        private readonly licenseManager: SpsValidatorLicenseManager,
    ) {
        // this.checkInWatcher.addValidatorCheckInWatcher() TODO add watcher so we can update the nextBlock if the config changes
        this.checkInAccount = config.reward_account ?? config.validator_account;
    }

    async prime(trx?: Trx | undefined): Promise<void> {
        if (this.primed) {
            return;
        }
        this.primed = true;
        if (!this.checkInWatcher.validator_check_in) {
            log('Validator check in config is invalid. Not setting next check in block.', LogLevel.Warning);
            return;
        }
        const checkIn = await this.checkInRepository.getByAccount(this.checkInAccount, trx);
        this.nextCheckInBlock = checkIn ? this.getNextCheckInBlock(checkIn.last_check_in_block_num) : undefined;
        log(`Next check in block: ${this.nextCheckInBlock}`, LogLevel.Info);
    }

    static isAvailable() {
        return config.validator_account && config.validator_key && config.enable_check_ins;
    }

    async onBlockProcessed(blockNumber: number, _: EventLog<any>[], blockHash: string): Promise<void> {
        if (!this.checkInWatcher.validator_check_in) {
            log('Validator check in config is invalid. Not sending check in.', LogLevel.Warning);
            return;
        }

        // Check if we need to check in
        if (this.nextCheckInBlock && blockNumber < this.nextCheckInBlock) {
            return;
        }

        // Check in
        const hash = this.licenseManager.getCheckInHash(blockHash, this.checkInAccount);
        // plugins are run asynchronously, so we need to set nextCheckInBlock before calling into async code
        this.nextCheckInBlock = this.getNextCheckInBlock(blockNumber);
        try {
            const confirmation = await this.hive.submitCheckIn(blockNumber, hash);
            log(`Checked in at block ${blockNumber}. trx_id: ${confirmation.id}`, LogLevel.Info);
        } catch (err) {
            log(`Failed to check in at block ${blockNumber}: ${err}`, LogLevel.Error);
            // reset next check in block if it failed
            this.nextCheckInBlock = undefined;
        }
    }

    private getNextCheckInBlock(last_check_in_block_num: number): number {
        // Check in within the first half of the window, to give us time to recover if the validator fails.
        const window = Math.floor(this.checkInWatcher.validator_check_in!.check_in_window_blocks / 2);
        const blocks = this.checkInWatcher.validator_check_in!.check_in_interval_blocks + Math.floor(Math.random() * window);
        return last_check_in_block_num + blocks;
    }
}
