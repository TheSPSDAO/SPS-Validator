import { Column, Table } from '@wwwouter/typed-knex';

export type ValidatorCheckInStatus = 'active' | 'inactive';

@Table('validator_check_in')
export class ValidatorCheckInEntity {
    @Column()
    account!: string;
    @Column()
    status!: ValidatorCheckInStatus;
    @Column()
    last_check_in_block_num!: number;
    @Column()
    last_check_in!: Date;
}
