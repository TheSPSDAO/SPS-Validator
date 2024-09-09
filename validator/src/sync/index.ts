import { SynchronisationConfig, SynchronisationPoint } from './type';

// This class collects all points
export class CollectedSynchronisationPoint<T extends SynchronisationConfig> {
    private readonly points: SynchronisationPoint<T>[];

    constructor(...points: SynchronisationPoint<T>[]) {
        this.points = points;
    }

    async waitToProcessBlock(block_num: number, ...args: T): Promise<void> {
        for (const point of this.points) {
            await point.waitToProcessBlock(block_num, ...args);
        }
    }
}

// This class closes over all the points
export abstract class SynchronisationClosure<T extends SynchronisationConfig> {
    constructor(private readonly pointWrapper: CollectedSynchronisationPoint<T>) {}

    protected abstract getConfig(): T;

    async waitToProcessBlock(block_num: number): Promise<void> {
        const cfg = this.getConfig();
        await this.pointWrapper.waitToProcessBlock(block_num, ...cfg);
    }
}
