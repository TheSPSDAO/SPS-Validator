import { HiveClient } from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';

@injectable()
export class HiveEngineRepository {
    constructor(@inject(HiveClient) private readonly client: HiveClient) {}

    async getCirculatingSupply(token: string) {
        const resp: { circulatingSupply: string } = await this.client.engine.contracts.findOne('tokens', 'tokens', { symbol: token });
        return parseFloat(resp.circulatingSupply);
    }

    async getBalance(account: string, token: string) {
        const resp = await this.client.engine.tokens.getAccountBalance(account, token);
        return parseFloat(resp.balance);
    }
}
