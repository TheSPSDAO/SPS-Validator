import { inject, injectable, InjectionToken } from 'tsyringe';

export interface ExternalPriceFeed {
    readonly name: string;
    getTokenPriceInUSD(token: string): Promise<number | null>;
}
export const ExternalPriceFeed: InjectionToken<ExternalPriceFeed> = Symbol('ExternalPriceFeed');

export type DaoExternalPriceFeedOpts = {
    api_url: string;
};
export const DaoExternalPriceFeedOpts: InjectionToken<DaoExternalPriceFeedOpts> = Symbol('DaoExternalPriceFeedOpts');
@injectable()
export class DaoExternalPriceFeed implements ExternalPriceFeed {
    readonly name = 'dao';

    private readonly apiUrl: string;

    constructor(@inject(DaoExternalPriceFeedOpts) private readonly opts: DaoExternalPriceFeedOpts) {
        this.apiUrl = opts.api_url?.endsWith('/') ? opts.api_url.slice(0, -1) : opts.api_url;
    }

    async getTokenPriceInUSD(token: string): Promise<number | null> {
        if (!this.opts || !this.apiUrl) {
            throw new Error('No url configured for DAO external feed');
        }

        const response = await fetch(`${this.apiUrl}/api/prices/${token}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch price for ${token} from DAO external feed. Status: ${response.status}. Body: ${await response.text()}`);
        }

        const json = (await response.json()) as { price_usd: string };
        const price = json?.price_usd;
        return price ? parseFloat(price) : null;
    }

    static isAvailable(opts: DaoExternalPriceFeedOpts) {
        return !!opts.api_url;
    }
}

export type CoinGeckoExternalPriceFeedOpts = {
    api_url: string;
    demo_api_url: string;
    demo: boolean;
    api_key: string;
};
export const CoinGeckoExternalPriceFeedOpts: InjectionToken<CoinGeckoExternalPriceFeedOpts> = Symbol('CoinGeckoExternalPriceFeedOpts');
@injectable()
export class CoinGeckoExternalPriceFeed implements ExternalPriceFeed {
    readonly name = 'coingecko';

    private readonly apiUrl: string;
    private readonly header: string;

    constructor(@inject(CoinGeckoExternalPriceFeedOpts) private readonly opts: CoinGeckoExternalPriceFeedOpts) {
        const apiUrl = opts.demo ? opts.demo_api_url : opts.api_url;
        this.apiUrl = apiUrl?.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
        this.header = opts.demo ? 'x_cg_demo_api_key' : 'x_cg_pro_api_key';
    }

    async getTokenPriceInUSD(token: string): Promise<number | null> {
        if (!this.opts || !this.apiUrl || !this.opts.api_key) {
            throw new Error('No url or api key configured for coin gecko external feed');
        }

        const response = await fetch(`${this.apiUrl}/api/v3/simple/price?ids=${encodeURIComponent(token)}&vs_currencies=USD`, {
            headers: {
                [this.header]: this.opts.api_key,
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch price for ${token} from coingecko external feed. Status: ${response.status}. Body: ${await response.text()}`);
        }

        const json = (await response.json()) as Record<string, { usd: string }>;
        const price = json?.[token]?.usd;
        return price ? parseFloat(price) : null;
    }

    static isAvailable(opts: CoinGeckoExternalPriceFeedOpts) {
        return !!opts.api_url && !!opts.api_key;
    }
}

export type CoinMarketCapExternalPriceFeedOpts = {
    api_url: string;
    api_key: string;
    token_map: Record<string, string>;
};
export const CoinMarketCapExternalPriceFeedOpts: InjectionToken<CoinMarketCapExternalPriceFeedOpts> = Symbol('CoinMarketCapExternalPriceFeedOpts');
@injectable()
export class CoinMarketCapExternalPriceFeed implements ExternalPriceFeed {
    readonly name = 'coinmarketcap';

    private readonly token_map: Map<string, string>;
    private readonly apiUrl: string;

    constructor(@inject(CoinMarketCapExternalPriceFeedOpts) private readonly opts: CoinMarketCapExternalPriceFeedOpts) {
        this.token_map = new Map(Object.entries(opts.token_map).map(([k, v]) => [k.toLowerCase(), v]));
        this.apiUrl = opts.api_url?.endsWith('/') ? opts.api_url.slice(0, -1) : opts.api_url;
    }

    async getTokenPriceInUSD(token: string): Promise<number | null> {
        if (!this.opts || !this.apiUrl || !this.opts.api_key) {
            throw new Error('No url or api key configured for coin market cap external feed');
        }

        const tokenUcid = this.token_map.get(token.toLowerCase());
        if (!tokenUcid) {
            throw new Error(`No mapping found for token ${token}`);
        }

        const response = await fetch(`${this.apiUrl}/v2/cryptocurrency/quotes/latest?id=${tokenUcid}`, {
            headers: {
                'X-CMC_PRO_API_KEY': this.opts.api_key,
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch price for ${token} from coin market cap external feed. Status: ${response.status}. Body: ${await response.text()}`);
        }

        const json = (await response.json()) as { data: Record<string, { quote: { USD: { price: string } } }> };
        const price = json?.data?.[tokenUcid]?.quote?.USD?.price;
        return price ? parseFloat(price) : null;
    }

    static isAvailable(opts: CoinMarketCapExternalPriceFeedOpts) {
        return !!opts.api_url && !!opts.api_key && !!opts.token_map && Object.keys(opts.token_map).length > 0;
    }
}
