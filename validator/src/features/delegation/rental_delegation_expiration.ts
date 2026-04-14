import { BlockRef } from '../../entities/block';
import { Trx } from '../../db/tables';
import { ProcessResult, VirtualPayloadSource } from '../../actions/virtual';
import { PrefixOpts } from '../../entities/operation';
import { RentalDelegationRepository } from '../../entities/rental/rental_delegation';

export type RentalDelegationExpirationSourceOpts = {
    /**
     * Block number at which the rental delegation expiration system becomes active.
     * Before this block, no expiration actions will be emitted.
     */
    transition_block?: number;
};

/**
 * Virtual payload source that emits an `expire_rental_delegations` action
 * each block if there are any rental delegations whose expiration_block
 * has been reached.
 *
 * This works alongside the existing promise expiration system but is
 * block-number-based rather than timestamp-based.
 */
export class RentalDelegationExpirationSource implements VirtualPayloadSource {
    private static readonly EXPIRATION_ACCOUNT = '$RENTAL_EXPIRATION';

    constructor(
        private readonly cfg: PrefixOpts,
        private readonly rentalDelegationRepository: RentalDelegationRepository,
        private readonly opts?: RentalDelegationExpirationSourceOpts,
    ) {}

    async process(block: BlockRef, trx?: Trx): Promise<ProcessResult[]> {
        // Don't emit expiration actions before the transition block
        if (this.opts?.transition_block !== undefined && block.block_num < this.opts.transition_block) {
            return [];
        }

        const expiredCount = await this.rentalDelegationRepository.countExpiredRentals(block.block_num, trx);
        if (expiredCount === 0) {
            return [];
        }

        return [
            [
                'custom_json',
                {
                    required_auths: [RentalDelegationExpirationSource.EXPIRATION_ACCOUNT],
                    required_posting_auths: [],
                    id: this.cfg.custom_json_id,
                    json: {
                        action: 'expire_rental_delegations',
                        params: {
                            block_num: block.block_num,
                        },
                    },
                },
            ],
        ];
    }

    trx_id(block: BlockRef): string {
        return `sl_expire_rental_delegations_${block.block_num}`;
    }
}
