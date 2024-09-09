export default class TokenTransfer {
    public amount: number;
    public from_start_balance: number;
    public from_end_balance: number;
    public to_start_balance: number;
    public to_end_balance: number;

    constructor(
        public from: string,
        public to: string,
        amount: string | number,
        public token: string,
        from_balance: string | number,
        to_balance: string | number,
        public type: string | null,
    ) {
        this.amount = parseFloat(amount as string);
        this.from_start_balance = parseFloat(from_balance as string);
        this.from_end_balance = parseFloat(from_balance as string) + this.amount * -1;
        this.to_start_balance = parseFloat(to_balance as string);
        this.to_end_balance = parseFloat(to_balance as string) + this.amount;
    }
}
