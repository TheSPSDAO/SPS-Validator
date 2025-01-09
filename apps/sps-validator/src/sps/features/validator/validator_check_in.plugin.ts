import { EventLog, HiveClient, LogLevel, Plugin, Prime, Trx, log } from '@steem-monsters/splinterlands-validator';
import { inject, singleton } from 'tsyringe';
import config from '../../convict-config';
import { SpsValidatorCheckInRepository } from '../../entities/validator/validator_check_in';
import { ValidatorCheckInWatch } from './validator_license.config';
import { SpsValidatorLicenseManager } from './validator_license.manager';

@singleton()
export class ValidatorCheckInPlugin implements Plugin, Prime {
    readonly name = 'validator_check_in';

    private readonly CHANGE_KEY = Symbol('CHECKIN_PLUGIN_CHANGE_KEY');

    private readonly checkInAccount: string;

    private primed = false;
    private lastCheckInBlock: number | undefined;
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
        this.checkInAccount = config.reward_account || config.validator_account;
        this.checkInWatcher.addValidatorCheckInWatcher(this.CHANGE_KEY, () => {
            this.nextCheckInBlock = this.lastCheckInBlock ? this.getNextCheckInBlock(this.lastCheckInBlock) : undefined;
        });
    }

    async prime(trx?: Trx | undefined): Promise<void> {
        if (this.primed) {
            return;
        }
        this.primed = true;
        if (!this.checkInAccount) {
            log('No check in account configured. Not setting next check in block.', LogLevel.Warning);
            return;
        } else if (!this.checkInWatcher.validator_check_in) {
            log('Validator check in config is invalid. Not setting next check in block.', LogLevel.Warning);
            return;
        }
        const checkIn = await this.checkInRepository.getByAccount(this.checkInAccount, trx);
        this.lastCheckInBlock = checkIn ? checkIn.last_check_in_block_num : undefined;
        this.nextCheckInBlock = this.lastCheckInBlock ? this.getNextCheckInBlock(this.lastCheckInBlock) : undefined;
        log(`Next check in block: ${this.nextCheckInBlock ?? 'asap'}`, LogLevel.Info);
    }

    static isAvailable() {
        return config.validator_account && config.validator_key && config.enable_check_ins;
    }

    async onBlockProcessed(blockNumber: number, _: EventLog<any>[], blockHash: string, headBlockNumber: number): Promise<void> {
        if (!this.checkInWatcher.validator_check_in) {
            log('Validator check in config is invalid. Not sending check in.', LogLevel.Warning);
            return;
        }
        // Check if we need to check in
        else if (this.nextCheckInBlock && blockNumber < this.nextCheckInBlock) {
            return;
        }
        // Check if we are too late to check in for this block
        else if (!this.licenseManager.isCheckInBlockWithinWindow(headBlockNumber, blockNumber)) {
            log('Check in would be too late. Not sending check in.', LogLevel.Debug);
            return;
        }

        // determine if we should check in (do we have staked licenses?). if we don't, we'll try again in the next block
        const { can_check_in } = await this.licenseManager.getCheckIn(this.checkInAccount, blockNumber);
        if (!can_check_in) {
            log('Cannot check in at this block.', LogLevel.Debug);
            return;
        }

        // plugins are run asynchronously, so we need to set nextCheckInBlock before calling into async code
        this.nextCheckInBlock = this.getNextCheckInBlock(blockNumber);

        // Check in
        const hash = this.licenseManager.getCheckInHash(blockHash, this.checkInAccount);
        try {
            const confirmation = await this.hive.submitCheckIn(blockNumber, hash);
            this.lastCheckInBlock = blockNumber;
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
