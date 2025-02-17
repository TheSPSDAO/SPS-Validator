import {
    BalanceRepository,
    BlockRef,
    BlockRepository,
    EventLog,
    IAction,
    LogLevel,
    PrefixOpts,
    ProcessResult,
    StakingConfiguration,
    StakingRewardsRepository,
    Trx,
    VirtualPayloadSource,
    log,
} from '@steem-monsters/splinterlands-validator';
import { inject, singleton } from 'tsyringe';
import { TOKENS } from '../tokens';
import { SpsValidatorCheckInRepository } from '../../entities/validator/validator_check_in';
import { ValidatorCheckInConfig, ValidatorCheckInWatch } from './config';
import { ValidatorCheckInEntity } from '../../entities/tables';
import { sha256 } from 'js-sha256';

export type ValidatorCheckInEntry = {
    account: string;
    can_check_in: boolean;
    is_valid: boolean;

    last_check_in_block_num?: number;
    last_check_in?: Date;
};

@singleton()
export class SpsValidatorLicenseManager implements VirtualPayloadSource {
    public static readonly LICENSE_MANAGER_ACCOUNT = '$LICENSE_MANAGER';
    private readonly CHANGE_KEY = Symbol('CHANGE_KEY');

    #checkInConfig?: ValidatorCheckInConfig;

    constructor(
        @inject(PrefixOpts) private readonly cfg: PrefixOpts,
        @inject(SpsValidatorCheckInRepository) private readonly checkInRepository: SpsValidatorCheckInRepository,
        @inject(StakingConfiguration) private readonly stakingConfig: StakingConfiguration,
        @inject(StakingRewardsRepository) private readonly stakingRewardsRepository: StakingRewardsRepository,
        @inject(BalanceRepository) private readonly balanceRepository: BalanceRepository,
        @inject(ValidatorCheckInWatch) private readonly validatorCheckInWatch: ValidatorCheckInWatch,
        @inject(BlockRepository) private readonly blockRepository: BlockRepository,
    ) {
        this.validatorCheckInWatch.addValidatorCheckInWatcher(this.CHANGE_KEY, (config) => {
            this.#checkInConfig = config;
        });
    }

    async process(block: BlockRef, trx?: Trx): Promise<ProcessResult[]> {
        const expiredBlockNum = this.getExpiredBlockNum(block.block_num);
        const expiredCheckIns = await this.checkInRepository.countExpired(expiredBlockNum, trx);
        if (expiredCheckIns === 0) {
            return [];
        }
        return [
            [
                'custom_json',
                {
                    required_auths: [SpsValidatorLicenseManager.LICENSE_MANAGER_ACCOUNT],
                    required_posting_auths: [],
                    id: this.cfg.custom_json_id,
                    json: {
                        action: 'expire_check_ins',
                        params: {},
                    },
                },
            ],
        ];
    }

    trx_id(block: BlockRef): string {
        return `sl_expire_check_ins_${block.block_num}`;
    }

    async getLicenses(account: string, trx?: Trx) {
        const activatedLicenses = await this.balanceRepository.getBalance(account, TOKENS.ACTIVATED_LICENSE, trx);
        const licenses = await this.balanceRepository.getBalance(account, TOKENS.LICENSE, trx);
        return { activatedLicenses, licenses };
    }

    async activateLicenses(action: IAction, account: string, qty: number, trx?: Trx) {
        if (this.#checkInConfig === undefined) {
            log('Invalid check in config. Ignoring license activation.', LogLevel.Warning);
            return [];
        }

        const results: EventLog[] = [];
        results.push(
            ...(await this.balanceRepository.updateBalance(action, account, SpsValidatorLicenseManager.LICENSE_MANAGER_ACCOUNT, TOKENS.LICENSE, qty, 'activate_license', trx)),
        );
        results.push(
            ...(await this.balanceRepository.updateBalance(
                action,
                SpsValidatorLicenseManager.LICENSE_MANAGER_ACCOUNT,
                account,
                TOKENS.ACTIVATED_LICENSE,
                qty,
                'activate_license',
                trx,
            )),
        );

        // Update the staked balance if theres a valid check-in
        const hasValidCheckIn = await this.hasValidCheckIn(account, action.op.block_num, trx);
        if (hasValidCheckIn) {
            results.push(...(await this.syncActivatedLicenses(account, action, trx)));
        }

        return results;
    }

    async deactivateLicenses(action: IAction, account: string, qty: number, trx?: Trx) {
        if (this.#checkInConfig === undefined) {
            log('Invalid check in config. Ignoring license deactivation.', LogLevel.Warning);
            return [];
        }

        const results: EventLog[] = [];
        results.push(
            ...(await this.balanceRepository.updateBalance(
                action,
                account,
                SpsValidatorLicenseManager.LICENSE_MANAGER_ACCOUNT,
                TOKENS.ACTIVATED_LICENSE,
                qty,
                'deactivate_license',
                trx,
            )),
        );
        results.push(
            ...(await this.balanceRepository.updateBalance(action, SpsValidatorLicenseManager.LICENSE_MANAGER_ACCOUNT, account, TOKENS.LICENSE, qty, 'deactivate_license', trx)),
        );

        // Update the staked balance if theres a valid check-in
        const hasValidCheckIn = await this.hasValidCheckIn(account, action.op.block_num, trx);
        if (hasValidCheckIn) {
            results.push(...(await this.syncActivatedLicenses(account, action, trx)));
        }

        return results;
    }

    async hasValidCheckIn(account: string, block_num: number, trx?: Trx) {
        const checkIn = await this.checkInRepository.getByAccount(account, trx);
        if (!checkIn) {
            return false;
        }
        return this.isCheckInValid(block_num, checkIn);
    }

    /**
     * Any activated licenses that are not staked should be staked
     */
    private async syncActivatedLicenses(account: string, action: IAction, trx?: Trx) {
        const results: EventLog[] = [];
        const balance = await this.balanceRepository.getBalance(account, TOKENS.ACTIVATED_LICENSE, trx);
        const stakedBalance = await this.balanceRepository.getBalance(account, TOKENS.RUNNING_LICENSE, trx);
        if (balance > stakedBalance) {
            // Stake the difference
            const qty = balance - stakedBalance;
            results.push(...(await this.stakingRewardsRepository.claimAll(account, [qty, TOKENS.RUNNING_LICENSE], action, trx)));
            results.push(
                ...(await this.balanceRepository.updateBalance(action, this.stakingConfig.staking_account, account, TOKENS.RUNNING_LICENSE, qty, 'sync_running_license', trx)),
            );
        } else if (balance < stakedBalance) {
            // Unstake the difference
            const qty = stakedBalance - balance;
            results.push(...(await this.stakingRewardsRepository.claimAll(account, [qty * -1, TOKENS.RUNNING_LICENSE], action, trx)));
            results.push(
                ...(await this.balanceRepository.updateBalance(action, account, this.stakingConfig.staking_account, TOKENS.RUNNING_LICENSE, qty, 'sync_running_license', trx)),
            );
        }
        return results;
    }

    async getCheckIn(account: string, block_num: number, trx?: Trx): Promise<ValidatorCheckInEntry> {
        if (this.#checkInConfig === undefined) {
            log('Invalid check in config. Assuming all check ins invalid.', LogLevel.Warning);
            return {
                account,
                can_check_in: false,
                is_valid: false,
            };
        }

        const poolPaused = block_num < this.#checkInConfig.paused_until_block;

        const checkIn = await this.checkInRepository.getByAccount(account, trx);
        const activatedLicenses = await this.balanceRepository.getBalance(account, TOKENS.ACTIVATED_LICENSE, trx);
        if (!checkIn) {
            return {
                account,
                can_check_in: !poolPaused && activatedLicenses > 0,
                is_valid: false,
            };
        }

        const canCheckIn = activatedLicenses > 0 && !poolPaused && block_num - checkIn.last_check_in_block_num >= this.#checkInConfig!.check_in_interval_blocks;

        return {
            account,
            can_check_in: canCheckIn,
            is_valid: this.isCheckInValid(block_num, checkIn),
            last_check_in_block_num: checkIn.last_check_in_block_num,
            last_check_in: checkIn.last_check_in,
        };
    }

    async checkIn(action: IAction, account: string, trx?: Trx) {
        if (this.#checkInConfig === undefined) {
            log('Invalid check in config. Ignoring check in.', LogLevel.Warning);
            return [];
        } else if (this.#checkInConfig.paused_until_block > action.op.block_num) {
            return [];
        }

        const results: EventLog[] = [];
        results.push(await this.checkInRepository.upsert({ account, status: 'active', last_check_in_block_num: action.op.block_num, last_check_in: action.op.block_time }, trx));
        // always need to sync on a check in because the account may have missed one
        results.push(...(await this.syncActivatedLicenses(account, action, trx)));
        return results;
    }

    async expireCheckIns(action: IAction, trx?: Trx) {
        if (this.#checkInConfig === undefined) {
            log('Invalid check in config. Ignoring check in expiration.', LogLevel.Warning);
            return [];
        }

        const results: EventLog[] = [];

        // get all active check-ins that are not valid
        const expiredBlockNum = this.getExpiredBlockNum(action.op.block_num);
        const expiredCheckIns = await this.checkInRepository.getExpired(expiredBlockNum, trx);

        for (const checkIn of expiredCheckIns) {
            results.push(...(await this.expireCheckIn(checkIn.account, action, trx)));
        }

        return results;
    }

    private getExpiredBlockNum(block_num: number) {
        return block_num - this.#checkInConfig!.check_in_window_blocks - this.#checkInConfig!.check_in_interval_blocks;
    }

    public async expireCheckIn(account: string, action: IAction, trx?: Trx) {
        const checkIn = await this.checkInRepository.getByAccount(account, trx);
        if (!checkIn) {
            return [];
        }

        const results: EventLog[] = [];

        // set inactive
        results.push(await this.checkInRepository.setInactive(account, trx));

        // unstake from the pool
        const stakedBalance = await this.balanceRepository.getBalance(account, TOKENS.RUNNING_LICENSE, trx);
        if (stakedBalance > 0) {
            results.push(...(await this.stakingRewardsRepository.claimAll(account, [stakedBalance * -1, TOKENS.RUNNING_LICENSE], action, trx)));
            results.push(
                ...(await this.balanceRepository.updateBalance(
                    action,
                    account,
                    this.stakingConfig.staking_account,
                    TOKENS.RUNNING_LICENSE,
                    stakedBalance,
                    'sync_running_license',
                    trx,
                )),
            );
        }

        return results;
    }

    private isCheckInValid(block_num: number, check_in: ValidatorCheckInEntity) {
        const checkInAge = block_num - check_in.last_check_in_block_num;
        const validCheckIn = checkInAge <= this.#checkInConfig!.check_in_window_blocks + this.#checkInConfig!.check_in_interval_blocks;
        return check_in.status === 'active' && validCheckIn;
    }

    async getCheckInHashForBlockNum(block_num: number, account: string, trx?: Trx): Promise<string | undefined> {
        const block = await this.blockRepository.getBlockHash(block_num, trx);
        if (!block) {
            return undefined;
        }
        return this.getCheckInHash(block.l2_block_id, account);
    }

    /**
     * verifies the check in block is within the window based off the current block
     * @param current_block_num current block number
     * @param check_in_block_num check in block number
     */
    isCheckInBlockWithinWindow(current_block_num: number, check_in_block_num: number) {
        return current_block_num - check_in_block_num <= this.#checkInConfig!.check_in_window_blocks;
    }

    getCheckInHash(block_hash: string, account: string): string {
        return sha256(`${block_hash}${account}`);
    }
}
