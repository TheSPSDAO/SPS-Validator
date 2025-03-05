import { injectable } from 'tsyringe';
import { JsonRpcProvider } from 'ethers';
import BigNumber from 'bignumber.js';

import { SpsAbi, SpsAbi__factory } from './types/ethers-contracts';

export type ERC20Opts = {
    rpc_node: string;
    contract_address: string;
};

export class BaseERC20Repository {
    private readonly provider: JsonRpcProvider;
    private readonly contract: SpsAbi;
    private readonly decimals: Promise<bigint>;

    constructor(opts: ERC20Opts) {
        this.provider = new JsonRpcProvider(opts.rpc_node);
        this.contract = SpsAbi__factory.connect(opts.contract_address, this.provider);
        this.decimals = this.contract.decimals().catch(() => 18n);
    }

    async getSupply(): Promise<number> {
        const supply = await this.contract.totalSupply();
        return await this.convertBalance(supply);
    }

    async getBalance(address: string): Promise<number> {
        const balance = await this.contract.balanceOf(address);
        return await this.convertBalance(balance);
    }

    private async convertBalance(supply: bigint) {
        const decimals = await this.decimals;
        const bigNum = new BigNumber(supply.toString());
        return bigNum.dividedBy(new BigNumber(10).pow(Number(decimals))).toNumber();
    }
}

@injectable()
export class SpsEthRepository extends BaseERC20Repository {
    constructor(opts: ERC20Opts) {
        super(opts);
    }
}

@injectable()
export class SpsBscRepository extends BaseERC20Repository {
    constructor(opts: ERC20Opts) {
        super(opts);
    }
}
