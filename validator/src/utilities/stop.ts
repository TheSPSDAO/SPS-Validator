export interface IStop {
    stop(): void;
    readonly shouldStop: boolean;
}

export class Stop implements IStop {
    #isStopped = false;
    stop(): void {
        this.#isStopped = true;
    }

    get shouldStop() {
        return this.#isStopped;
    }
}
