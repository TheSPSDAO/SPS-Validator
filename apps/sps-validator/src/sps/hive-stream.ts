import { inject, injectable } from 'tsyringe';
import { Client } from 'splinterlands-dhive-sl';
import { HiveStream, HiveStreamOptions } from '@steem-monsters/splinterlands-validator';

@injectable()
export class SpsHiveStream extends HiveStream {
    public constructor(@inject(Client) client: Client, @inject(HiveStreamOptions) options: HiveStreamOptions) {
        super(client, options);
    }
}
