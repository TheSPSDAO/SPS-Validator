import { EventLog, HiveClient, LogLevel, Plugin, Prime, Trx, ValidatorRepository, log } from '@steem-monsters/splinterlands-validator';
import { inject, singleton } from 'tsyringe';
import config from '../../convict-config';
import { SpsValidatorCheckInRepository } from '../../entities/validator/validator_check_in';
import { ValidatorCheckInWatch } from './config';
import { SpsValidatorLicenseManager } from './license-manager';

@singleton()
export class ValidatorCheckInPlugin implements Plugin, Prime {
    readonly name = 'validator_check_in';

    private readonly CHANGE_KEY = Symbol('CHECKIN_PLUGIN_CHANGE_KEY');

    private readonly validatorAccount: string;

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
        @inject(ValidatorRepository)
        private readonly validatorRepository: ValidatorRepository,
    ) {
        this.validatorAccount = config.validator_account;
        this.checkInWatcher.addValidatorCheckInWatcher(this.CHANGE_KEY, (value) => {
            this.nextCheckInBlock = this.lastCheckInBlock ? this.getNextCheckInBlock(this.lastCheckInBlock) : undefined;
        });
    }

    async prime(trx?: Trx | undefined): Promise<void> {
        if (this.primed) {
            return;
        }
        this.primed = true;
        if (!this.validatorAccount) {
            log('No check in account configured. Not setting next check in block.', LogLevel.Warning);
            return;
        } else if (!this.checkInWatcher.validator_check_in) {
            log('Validator check in config is invalid. Not setting next check in block.', LogLevel.Warning);
            return;
        }
        const validator = await this.validatorRepository.lookup(this.validatorAccount, trx);
        const rewardAccount = validator ? validator?.reward_account ?? this.validatorAccount : undefined;
        const checkIn = rewardAccount ? await this.checkInRepository.getByAccount(rewardAccount, trx) : undefined;
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
        } else if (!this.licenseManager.isCheckInBlockWithinWindow(headBlockNumber, blockNumber)) {
            log('Check in would be too late. Not sending check in.', LogLevel.Debug);
            return;
        }

        const validator = await this.validatorRepository.lookup(this.validatorAccount);
        if (!validator || !validator.is_active) {
            log('Validator not found or inactive. Not sending check in.', LogLevel.Warning);
            return;
        }
        const rewardAccount = validator.reward_account ?? this.validatorAccount;

        // determine if we should check in (do we have staked licenses?). if we don't, we'll try again in the next block
        const { can_check_in } = await this.licenseManager.getCheckIn(rewardAccount, blockNumber);
        if (!can_check_in) {
            log('Cannot check in at this block.', LogLevel.Debug);
            return;
        }

        // if we _can_ check in, but we're not at the next check in block, we should check that something didnt change
        // like the validator becoming inactive, or the check in window changing.
        // checking if we're within the check in window should be enough
        const blocksToCheckIn = this.nextCheckInBlock ? blockNumber - this.nextCheckInBlock : 0;
        if (blocksToCheckIn < this.checkInWatcher.validator_check_in!.check_in_window_blocks) {
            return;
        }

        // plugins are run asynchronously, so we need to set nextCheckInBlock before calling into async code
        this.nextCheckInBlock = this.getNextCheckInBlock(blockNumber);

        // Check in
        const hash = this.licenseManager.getCheckInHash(blockHash, this.validatorAccount);
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
