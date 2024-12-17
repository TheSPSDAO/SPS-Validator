import { Transaction } from './openapi';
import { DefaultService } from './openapi/services/DefaultService';

export class TxLookupService {
    static async waitForTx(txId: string, timeout = 30000): Promise<Transaction> {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                return await DefaultService.getTransaction(txId);
            } catch (e) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
        throw new Error('Timeout waiting for transaction. The transaction may still be processing. Refresh this page in a few minutes and try again.');
    }
}
